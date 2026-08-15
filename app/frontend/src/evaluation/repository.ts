import { getCaseDefinition, sourceArtifactsForCase, validateRubric } from "./rubrics";
import {
  initialHumanScores,
  isFinalStatus,
  latestCompletedAssessments,
  recommendedOutcome,
  validateReview,
} from "./domain";
import { SEEDED_ATTEMPTS } from "./fixtures";
import type {
  Attempt,
  Credential,
  FinalizeResult,
  LearnerAccess,
  NotificationRecord,
  PublicCredential,
  ReviewDraftInput,
  SubmitAttemptInput,
} from "./types";

export interface EvaluatorSession {
  token: string;
  evaluatorName: string;
  expiresAt: string;
}

export interface EvaluationRepository {
  authenticateEvaluator(code: string, evaluatorName: string): Promise<EvaluatorSession>;
  listAttempts(): Promise<Attempt[]>;
  getAttempt(attemptId: string): Promise<Attempt | null>;
  submitAttempt(input: SubmitAttemptInput): Promise<{
    attempt: Attempt;
    access: LearnerAccess;
    notification: NotificationRecord;
  }>;
  retryEvaluation(attemptId: string): Promise<Attempt>;
  claimReview(attemptId: string, evaluatorName: string, takeover?: boolean): Promise<Attempt>;
  releaseClaim(attemptId: string, evaluatorName: string): Promise<Attempt>;
  saveReview(attemptId: string, evaluatorName: string, draft: ReviewDraftInput): Promise<Attempt>;
  finalizeReview(attemptId: string, evaluatorName: string, draft: ReviewDraftInput): Promise<FinalizeResult>;
  getLearnerCollection(privateToken: string): Promise<{
    access: LearnerAccess;
    attempts: Attempt[];
    credentials: Credential[];
  } | null>;
  rotatePrivateAccess(privateToken: string): Promise<LearnerAccess>;
  createPublicLink(credentialId: string, privateToken: string): Promise<Credential>;
  revokePublicLink(credentialId: string, privateToken: string): Promise<Credential>;
  resolvePublicCredential(publicToken: string): Promise<PublicCredential | null>;
}

interface LocalStore {
  attempts: Attempt[];
  credentials: Credential[];
  notifications: NotificationRecord[];
  learners: LearnerAccess[];
}

const STORAGE_KEY = "simworks:evaluation-program:v1";
const CLAIM_MS = 15 * 60 * 1000;

function clone<T>(value: T): T {
  if (value === undefined) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function submissionMetadata(
  transcript: SubmitAttemptInput["transcript"],
  workProduct: string,
  sourceArtifactCount: number,
) {
  const timestamps = transcript
    .map((message) => new Date(message.createdAt).getTime())
    .filter(Number.isFinite)
    .sort((left, right) => left - right);
  return {
    messageCount: transcript.length,
    learnerMessageCount: transcript.filter(
      (message) => message.role === "learner",
    ).length,
    agentMessageCount: transcript.filter(
      (message) => message.role === "agent",
    ).length,
    failedMessageCount: transcript.filter(
      (message) => message.status === "failed",
    ).length,
    workProductCharacterCount: workProduct.length,
    sourceArtifactCount,
    ...(timestamps.length
      ? {
          firstInteractionAt: new Date(timestamps[0]).toISOString(),
          lastInteractionAt: new Date(
            timestamps[timestamps.length - 1],
          ).toISOString(),
        }
      : {}),
  };
}

function randomToken(prefix: string) {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "")
      : `${Date.now()}${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${id}${id}`;
}

function now() {
  return new Date().toISOString();
}

function plusMs(value: number) {
  return new Date(Date.now() + value).toISOString();
}

function readStore(): LocalStore {
  if (typeof window === "undefined") {
    return { attempts: clone(SEEDED_ATTEMPTS), credentials: [], notifications: [], learners: [] };
  }
  const existing = window.localStorage.getItem(STORAGE_KEY);
  if (existing) return JSON.parse(existing) as LocalStore;
  const initial: LocalStore = {
    attempts: clone(SEEDED_ATTEMPTS),
    credentials: [],
    notifications: [],
    learners: [],
  };
  writeStore(initial);
  return initial;
}

function writeStore(store: LocalStore) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
}

function getMutableAttempt(store: LocalStore, attemptId: string): Attempt {
  const attempt = store.attempts.find((item) => item.id === attemptId);
  if (!attempt) throw new Error("Attempt not found.");
  return attempt;
}

function assertClaim(attempt: Attempt, evaluatorName: string) {
  if (
    !attempt.claim ||
    attempt.claim.evaluatorName !== evaluatorName ||
    new Date(attempt.claim.expiresAt).getTime() <= Date.now()
  ) {
    throw new Error("Your review claim has expired or belongs to another evaluator.");
  }
}

function stampedScores(
  attempt: Attempt,
  evaluatorName: string,
  scores: ReviewDraftInput["scores"],
) {
  const aiById = new Map(
    latestCompletedAssessments(attempt).map((item) => [
      item.criterionId,
      item.points,
    ]),
  );
  const overriddenAt = now();
  return scores.map((score) =>
    aiById.has(score.criterionId) &&
    aiById.get(score.criterionId) !== score.points
      ? { ...score, overriddenBy: evaluatorName, overriddenAt }
      : {
          criterionId: score.criterionId,
          points: score.points,
          note: score.note,
          overrideReason: score.overrideReason,
        },
  );
}

export class LocalEvaluationRepository implements EvaluationRepository {
  async authenticateEvaluator(code: string, evaluatorName: string) {
    const demoCode = import.meta.env?.VITE_DEMO_EVALUATOR_CODE || "SIMWORKS-DEMO";
    if (code !== demoCode) throw new Error("Invalid evaluator access code.");
    if (!evaluatorName.trim()) throw new Error("Evaluator display name is required.");
    return {
      token: randomToken("eval"),
      evaluatorName: evaluatorName.trim(),
      expiresAt: plusMs(8 * 60 * 60 * 1000),
    };
  }

  async listAttempts() {
    return clone(readStore().attempts);
  }

  async getAttempt(attemptId: string) {
    return clone(readStore().attempts.find((item) => item.id === attemptId) ?? null);
  }

  async submitAttempt(input: SubmitAttemptInput) {
    const definition = getCaseDefinition(input.caseId);
    const rubricErrors = validateRubric(definition);
    if (rubricErrors.length) throw new Error(rubricErrors.join(" "));
    if (!definition.released) throw new Error("This case is not released for learner submission.");

    const store = readStore();
    const existing = store.attempts.find(
      (attempt) =>
        attempt.participantId === input.participantId &&
        attempt.idempotencyKey === input.idempotencyKey,
    );
    if (existing) {
      const access = store.learners.find(
        (learner) => learner.participantId === input.participantId,
      );
      const notification = store.notifications.find(
        (item) => item.kind === "submission_receipt" && item.attemptId === existing.id,
      );
      if (!access || !notification) throw new Error("Submission receipt is incomplete.");
      return { attempt: clone(existing), access: clone(access), notification: clone(notification) };
    }

    let access = store.learners.find(
      (learner) => learner.participantId === input.participantId,
    );
    if (!access) {
      access = {
        participantId: input.participantId,
        displayName: input.displayName.trim(),
        email: input.email.trim(),
        privateToken: randomToken("private"),
      };
      store.learners.push(access);
    } else {
      access.displayName = input.displayName.trim();
      access.email = input.email.trim();
    }
    const attemptNumber =
      store.attempts.filter(
        (item) =>
          item.participantId === input.participantId &&
          item.caseId === input.caseId,
      ).length + 1;
    const id = randomToken("att").slice(0, 36);
    const submittedAt = now();
    const sourceArtifacts = sourceArtifactsForCase(definition.id);
    const attempt: Attempt = {
      id,
      participantId: input.participantId,
      learnerDisplayName: input.displayName.trim(),
      caseId: definition.id,
      caseTitle: definition.title,
      category: definition.category,
      caseVersion: definition.version,
      rubricVersion: definition.rubric.rubricVersion,
      evaluationMode: definition.evaluationMode,
      attemptNumber,
      predecessorAttemptId: input.predecessorAttemptId,
      transcript: clone(input.transcript),
      workProduct: input.workProduct,
      sourceArtifacts,
      submissionMetadata: submissionMetadata(
        input.transcript,
        input.workProduct,
        sourceArtifacts.length,
      ),
      submittedAt,
      idempotencyKey: input.idempotencyKey,
      status: "ai_failed",
      evaluationRuns: [
        {
          id: randomToken("run").slice(0, 36),
          attemptId: id,
          provider: "prototype-rules",
          model: "deterministic-fixture",
          promptVersion: "1.0.0",
          caseVersion: definition.version,
          rubricVersion: definition.rubric.rubricVersion,
          startedAt: submittedAt,
          completedAt: submittedAt,
          status: "failed",
          assessments: definition.rubric.criteria.map((item) => ({
            criterionId: item.id,
            points: 0,
            explanation: "Awaiting production provider evaluation; human scoring is available.",
            evidence: [],
            supported: false,
          })),
          caseScore: 0,
          interactionScore: 0,
          recommendation: "not_yet_ready",
          validationErrors: ["Production AI evaluator is not configured."],
        },
      ],
    };
    const notification: NotificationRecord = {
      id: `receipt:${id}`,
      kind: "submission_receipt",
      attemptId: id,
      status: "queued",
      createdAt: submittedAt,
    };
    store.attempts.push(attempt);
    store.notifications.push(notification);
    writeStore(store);
    return { attempt: clone(attempt), access: clone(access), notification: clone(notification) };
  }

  async retryEvaluation(attemptId: string) {
    const store = readStore();
    const attempt = getMutableAttempt(store, attemptId);
    if (isFinalStatus(attempt.status)) throw new Error("Finalized attempts cannot be re-evaluated.");
    const parent = attempt.evaluationRuns[attempt.evaluationRuns.length - 1];
    attempt.evaluationRuns.push({
      ...clone(parent),
      id: randomToken("run").slice(0, 36),
      parentRunId: parent.id,
      startedAt: now(),
      completedAt: now(),
      status: "failed",
      validationErrors: ["Production AI evaluator is not configured."],
    });
    attempt.status = "ai_failed";
    writeStore(store);
    return clone(attempt);
  }

  async claimReview(attemptId: string, evaluatorName: string, takeover = false) {
    const store = readStore();
    const attempt = getMutableAttempt(store, attemptId);
    if (isFinalStatus(attempt.status)) throw new Error("Finalized attempts are read-only.");
    if (attempt.status === "pending_ai_processing" || attempt.status === "ai_processing") throw new Error("AI evaluation has not completed yet.");
    const active = attempt.claim && new Date(attempt.claim.expiresAt).getTime() > Date.now();
    if (active && attempt.claim?.evaluatorName !== evaluatorName && !takeover) {
      throw new Error(`This review is currently claimed by ${attempt.claim?.evaluatorName}.`);
    }
    const previous = attempt.claim;
    const takeoverHistory = previous?.takeoverHistory ?? [];
    if (active && previous && previous.evaluatorName !== evaluatorName && takeover) {
      takeoverHistory.push({ from: previous.evaluatorName, to: evaluatorName, at: now() });
    }
    attempt.claim = {
      evaluatorName,
      claimedAt: previous?.evaluatorName === evaluatorName ? previous.claimedAt : now(),
      expiresAt: plusMs(CLAIM_MS),
      takeoverHistory,
    };
    attempt.status = "in_review";
    writeStore(store);
    return clone(attempt);
  }

  async releaseClaim(attemptId: string, evaluatorName: string) {
    const store = readStore();
    const attempt = getMutableAttempt(store, attemptId);
    if (attempt.claim?.evaluatorName === evaluatorName) {
      delete attempt.claim;
      if (!isFinalStatus(attempt.status)) {
        const latestRun = attempt.evaluationRuns[attempt.evaluationRuns.length - 1];
        attempt.status =
          latestRun?.status === "processing"
            ? "ai_processing"
            : latestRun?.status === "completed"
              ? "ready_for_review"
              : "ai_failed";
      }
      writeStore(store);
    }
    return clone(attempt);
  }

  async saveReview(attemptId: string, evaluatorName: string, draft: ReviewDraftInput) {
    const store = readStore();
    const attempt = getMutableAttempt(store, attemptId);
    assertClaim(attempt, evaluatorName);
    const errors = validateReview(attempt, draft);
    if (errors.length) throw new Error(errors.join("\n"));
    attempt.review = {
      version: attempt.review?.version ?? 1,
      status: "draft",
      evaluatorName,
      ...clone(draft),
      scores: stampedScores(attempt, evaluatorName, draft.scores),
      savedAt: now(),
    };
    attempt.claim!.expiresAt = plusMs(CLAIM_MS);
    writeStore(store);
    return clone(attempt);
  }

  async finalizeReview(attemptId: string, evaluatorName: string, draft: ReviewDraftInput) {
    const store = readStore();
    const attempt = getMutableAttempt(store, attemptId);
    if (attempt.review?.status === "final") {
      const notification = store.notifications.find(
        (item) =>
          item.kind === "result" &&
          item.attemptId === attempt.id &&
          item.reviewVersion === attempt.review?.version,
      );
      if (!notification) throw new Error("Final result notification record is missing.");
      return {
        attempt: clone(attempt),
        credential: clone(store.credentials.find((item) => item.attemptId === attempt.id)),
        notification: clone(notification),
      };
    }
    assertClaim(attempt, evaluatorName);
    const errors = validateReview(attempt, draft);
    if (errors.length) throw new Error(errors.join("\n"));
    const finalizedAt = now();
    const reviewVersion = attempt.review?.version ?? 1;
    attempt.review = {
      version: reviewVersion,
      status: "final",
      evaluatorName,
      ...clone(draft),
      scores: stampedScores(attempt, evaluatorName, draft.scores),
      savedAt: finalizedAt,
      finalizedAt,
    };
    attempt.status = draft.outcome;
    delete attempt.claim;

    let notification = store.notifications.find(
      (item) =>
        item.kind === "result" &&
        item.attemptId === attempt.id &&
        item.reviewVersion === reviewVersion,
    );
    if (!notification) {
      notification = {
        id: `result:${attempt.id}:${reviewVersion}`,
        kind: "result",
        attemptId: attempt.id,
        reviewVersion,
        status: "queued",
        createdAt: finalizedAt,
      };
      store.notifications.push(notification);
    }

    let credential = store.credentials.find((item) => item.attemptId === attempt.id);
    if (draft.outcome === "pass" && !credential) {
      credential = {
        id: randomToken("cred").slice(0, 36),
        attemptId: attempt.id,
        participantId: attempt.participantId,
        learnerDisplayName: attempt.learnerDisplayName,
        caseId: attempt.caseId,
        caseTitle: attempt.caseTitle,
        category: attempt.category,
        caseVersion: attempt.caseVersion,
        rubricVersion: attempt.rubricVersion,
        attemptNumber: attempt.attemptNumber,
        awardDate: finalizedAt,
        issuer: "SimWorks",
        evaluationAuthority: "Human verified with AI-assisted scoring",
        ...(draft.supplementalLabel?.trim()
          ? { supplementalLabel: draft.supplementalLabel.trim() }
          : {}),
        status: "private",
      };
      store.credentials.push(credential);
    }
    writeStore(store);
    return { attempt: clone(attempt), credential: clone(credential), notification: clone(notification) };
  }

  async getLearnerCollection(privateToken: string) {
    const store = readStore();
    const access = store.learners.find((item) => item.privateToken === privateToken);
    if (!access) return null;
    return {
      access: clone(access),
      attempts: clone(store.attempts.filter((item) => item.participantId === access.participantId)),
      credentials: clone(store.credentials.filter((item) => item.participantId === access.participantId)),
    };
  }

  async rotatePrivateAccess(privateToken: string) {
    const store = readStore();
    const access = store.learners.find((item) => item.privateToken === privateToken);
    if (!access) throw new Error("Private access link not found.");
    access.privateToken = randomToken("private");
    writeStore(store);
    return clone(access);
  }

  async createPublicLink(credentialId: string, privateToken: string) {
    const store = readStore();
    const access = store.learners.find((item) => item.privateToken === privateToken);
    const credential = store.credentials.find((item) => item.id === credentialId);
    if (!access || !credential || credential.participantId !== access.participantId) {
      throw new Error("Credential not found.");
    }
    if (credential.status === "public" && credential.publicToken) {
      return clone(credential);
    }
    credential.publicToken = randomToken("verify");
    credential.status = "public";
    writeStore(store);
    return clone(credential);
  }

  async revokePublicLink(credentialId: string, privateToken: string) {
    const store = readStore();
    const access = store.learners.find((item) => item.privateToken === privateToken);
    const credential = store.credentials.find((item) => item.id === credentialId);
    if (!access || !credential || credential.participantId !== access.participantId) {
      throw new Error("Credential not found.");
    }
    credential.status = "revoked";
    writeStore(store);
    return clone(credential);
  }

  async resolvePublicCredential(publicToken: string) {
    const credential = readStore().credentials.find(
      (item) => item.publicToken === publicToken,
    );
    return credential?.status === "public" ? clone(credential) : null;
  }
}

export class HttpEvaluationRepository implements EvaluationRepository {
  constructor(private readonly baseUrl: string) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const session =
      typeof window === "undefined"
        ? null
        : window.sessionStorage.getItem("simworks:evaluator-session");
    const sessionToken = session
      ? (JSON.parse(session) as EvaluatorSession).token
      : "";
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(sessionToken ? { authorization: `Bearer ${sessionToken}` } : {}),
        ...init?.headers,
      },
    });
    const body = (await response.json()) as T & { error?: string };
    if (!response.ok) throw new Error(body.error || "Evaluation service request failed.");
    return body;
  }

  authenticateEvaluator(code: string, evaluatorName: string) {
    return this.request<EvaluatorSession>("/evaluator/session", {
      method: "POST",
      body: JSON.stringify({ code, evaluatorName }),
    });
  }
  listAttempts() { return this.request<Attempt[]>("/attempts"); }
  getAttempt(id: string) { return this.request<Attempt | null>(`/attempts/${id}`); }
  submitAttempt(input: SubmitAttemptInput) {
    return this.request<{ attempt: Attempt; access: LearnerAccess; notification: NotificationRecord }>("/attempts", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }
  retryEvaluation(id: string) { return this.request<Attempt>(`/attempts/${id}/evaluation-runs`, { method: "POST" }); }
  claimReview(id: string, evaluatorName: string, takeover = false) {
    return this.request<Attempt>(`/attempts/${id}/claim`, { method: "POST", body: JSON.stringify({ evaluatorName, takeover }) });
  }
  releaseClaim(id: string, evaluatorName: string) {
    return this.request<Attempt>(`/attempts/${id}/claim`, { method: "DELETE", body: JSON.stringify({ evaluatorName }) });
  }
  saveReview(id: string, evaluatorName: string, draft: ReviewDraftInput) {
    return this.request<Attempt>(`/attempts/${id}/review`, { method: "PUT", body: JSON.stringify({ evaluatorName, draft }) });
  }
  finalizeReview(id: string, evaluatorName: string, draft: ReviewDraftInput) {
    return this.request<FinalizeResult>(`/attempts/${id}/finalize`, { method: "POST", body: JSON.stringify({ evaluatorName, draft }) });
  }
  getLearnerCollection(token: string) {
    return this.request<{ access: LearnerAccess; attempts: Attempt[]; credentials: Credential[] } | null>(
      "/credentials/private/resolve",
      {
        method: "POST",
        body: JSON.stringify({ privateToken: token }),
      },
    );
  }
  rotatePrivateAccess(token: string) {
    return this.request<LearnerAccess>("/credentials/private/rotate", {
      method: "POST",
      body: JSON.stringify({ privateToken: token }),
    });
  }
  createPublicLink(id: string, token: string) {
    return this.request<Credential>(`/credentials/${id}/public`, { method: "POST", body: JSON.stringify({ privateToken: token }) });
  }
  revokePublicLink(id: string, token: string) {
    return this.request<Credential>(`/credentials/${id}/public`, { method: "DELETE", body: JSON.stringify({ privateToken: token }) });
  }
  resolvePublicCredential(token: string) {
    return this.request<PublicCredential | null>(`/credentials/public/${token}`);
  }
}

const endpoint = import.meta.env?.VITE_EVALUATION_API_ENDPOINT as string | undefined;
export const evaluationRepository: EvaluationRepository = endpoint
  ? new HttpEvaluationRepository(endpoint.replace(/\/$/, ""))
  : new LocalEvaluationRepository();

// On localhost (DEV), call the Cloud Run function directly — it has cors:true so the browser allows it.
// On production, use a relative URL that Firebase Hosting rewrites to the same function.
const evalApiBase = endpoint?.replace(/\/$/, "")
  ?? (import.meta.env?.DEV ? "https://evaluationapi-5iwaz2l7bq-uc.a.run.app" : "/api/evaluation");

export const credentialsApi = new HttpEvaluationRepository(evalApiBase);

export async function getLearnerCollectionByEmail(email: string): Promise<{
  access: LearnerAccess;
  attempts: Attempt[];
  credentials: Credential[];
} | null> {
  const response = await fetch(`${evalApiBase}/credentials/by-email`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const body = await response.json() as ({ access: LearnerAccess; attempts: Attempt[]; credentials: Credential[] } | null) & { error?: string };
  if (!response.ok) throw new Error(body?.error || "Failed to load credentials.");
  return body;
}

export function draftForAttempt(attempt: Attempt): ReviewDraftInput {
  return {
    scores: attempt.review?.scores ?? initialHumanScores(attempt),
    summary: attempt.review?.summary ?? "",
    outcome: attempt.review?.outcome ?? recommendedOutcome(attempt),
    outcomeOverrideReason: attempt.review?.outcomeOverrideReason ?? "",
    supplementalLabel: attempt.review?.supplementalLabel ?? "",
  };
}

export function countSupportedEvidence(attempt: Attempt) {
  return latestCompletedAssessments(attempt).reduce(
    (sum, item) => sum + item.evidence.filter((evidence) => evidence.resolved).length,
    0,
  );
}
