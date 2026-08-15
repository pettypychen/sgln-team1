"use strict";

const crypto = require("node:crypto");
const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const CASE_PACKAGES = require("./generated/cases.json");
const { derivePrivateToken } = require("./token");

if (!getApps().length) initializeApp();
const db = getFirestore();

const EVALUATOR_ACCESS_CODE = defineSecret("EVALUATOR_ACCESS_CODE");
const PRIVATE_TOKEN_SECRET = defineSecret("PRIVATE_TOKEN_SECRET");
const EVALUATION_API_KEY = defineSecret("EVALUATION_API_KEY");

const CLAIM_MS = 15 * 60 * 1000;
const SESSION_MS = 8 * 60 * 60 * 1000;

const CASES = {
  "first-year-associate-ma-due-diligence": {
    id: "first-year-associate-ma-due-diligence",
    title: "First-Year Associate: M&A Due Diligence",
    category: "Legal",
    version: "1.0.0",
    rubricVersion: "1.0.0",
    released: true,
    evaluationMode: "human_final",
    caseThreshold: 56,
    interactionThreshold: 14,
    criteria: [
      ["legal-transaction-map", "case_outcome", 12],
      ["legal-issue-log", "case_outcome", 24],
      ["legal-request-list", "case_outcome", 18],
      ["legal-summary", "case_outcome", 16],
      ["legal-source-use", "ai_interaction", 10],
      ["legal-challenge", "ai_interaction", 10],
      ["legal-judgment", "ai_interaction", 10, true],
    ],
  },
  "month-end-close-under-pressure": {
    id: "month-end-close-under-pressure",
    title: "Month-End Close Under Pressure",
    category: "Accounting",
    version: "1.0.0",
    rubricVersion: "1.0.0",
    released: true,
    evaluationMode: "human_final",
    caseThreshold: 52,
    interactionThreshold: 14,
    criteria: [
      ["close-exceptions", "case_outcome", 24],
      ["close-calculations", "case_outcome", 18],
      ["close-priority", "case_outcome", 14],
      ["close-update", "case_outcome", 14],
      ["close-prompting", "ai_interaction", 10],
      ["close-challenge", "ai_interaction", 12, true],
      ["close-boundary", "ai_interaction", 8],
    ],
  },
  "kopi-run": {
    id: "kopi-run",
    title: "Kopi Run",
    category: "Onboarding",
    version: "1.0.0",
    rubricVersion: "1.0.0",
    released: true,
    evaluationMode: "human_final",
    caseThreshold: 48,
    interactionThreshold: 18,
    criteria: [
      ["kopi-orders", "case_outcome", 24],
      ["kopi-clarify", "case_outcome", 12, true],
      ["kopi-substitute", "case_outcome", 12],
      ["kopi-total", "case_outcome", 12],
      ["kopi-constraints", "ai_interaction", 10],
      ["kopi-correction", "ai_interaction", 12, true],
      ["kopi-final", "ai_interaction", 8],
    ],
  },
};

for (const [caseId, packageDefinition] of Object.entries(CASE_PACKAGES)) {
  const definition = CASES[caseId] || {};
  CASES[caseId] = {
    ...definition,
    id: packageDefinition.id,
    title: packageDefinition.title,
    category: packageDefinition.category,
    version: packageDefinition.version,
    rubricVersion: packageDefinition.rubricVersion,
    released: packageDefinition.released,
    evaluationMode: packageDefinition.evaluationMode,
    caseThreshold: packageDefinition.rubric.caseThreshold,
    interactionThreshold: packageDefinition.rubric.interactionThreshold,
    criteria: packageDefinition.rubric.criteria.map((criterion) => [
      criterion.id,
      criterion.dimension,
      criterion.maxPoints,
      Boolean(criterion.criticalFailure),
    ]),
    structuredRubric: packageDefinition.rubric,
    caseInstructions: packageDefinition.caseInstructions,
    evaluationGuidance: packageDefinition.evaluationGuidance,
    coachingPrompt: packageDefinition.coachingPrompt,
    evaluationPrompt: packageDefinition.evaluationPrompt,
    artifacts: packageDefinition.artifacts,
  };
}

function iso() {
  return new Date().toISOString();
}

function id(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

function hash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function publicCredentialView(credential) {
  if (!credential) return null;
  return {
    id: credential.id,
    learnerDisplayName: credential.learnerDisplayName,
    caseId: credential.caseId,
    caseTitle: credential.caseTitle,
    category: credential.category,
    awardDate: credential.awardDate,
    issuer: credential.issuer,
    evaluationAuthority: credential.evaluationAuthority,
    ...(credential.supplementalLabel
      ? { supplementalLabel: credential.supplementalLabel }
      : {}),
    status: credential.status,
  };
}

function statusAfterClaimRelease(attempt) {
  const latestRun = attempt.evaluationRuns?.[attempt.evaluationRuns.length - 1];
  if (latestRun?.status === "processing") return "ai_processing";
  if (latestRun?.status === "completed") return "ready_for_review";
  return "ai_failed";
}

function submissionMetadata(transcript, workProduct, sourceArtifacts) {
  const messages = Array.isArray(transcript) ? transcript : [];
  const timestamps = messages
    .map((message) => new Date(message.createdAt).getTime())
    .filter(Number.isFinite)
    .sort((left, right) => left - right);
  return {
    messageCount: messages.length,
    learnerMessageCount: messages.filter(
      (message) => message.role === "learner",
    ).length,
    agentMessageCount: messages.filter((message) => message.role === "agent")
      .length,
    failedMessageCount: messages.filter(
      (message) => message.status === "failed",
    ).length,
    workProductCharacterCount: String(workProduct || "").length,
    sourceArtifactCount: sourceArtifacts.length,
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

function validateSubmissionInput(input) {
  const errors = [];
  const displayName = String(input?.displayName || "").trim();
  const email = String(input?.email || "").trim();
  const participantId = String(input?.participantId || "");
  const idempotencyKey = String(input?.idempotencyKey || "");
  if (!displayName || displayName.length > 120) {
    errors.push("Display name must be 1–120 characters.");
  }
  if (
    !email ||
    email.length > 320 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    errors.push("A valid email address is required.");
  }
  if (!participantId || participantId.length > 200) {
    errors.push("Participant ID must be 1–200 characters.");
  }
  if (!idempotencyKey || idempotencyKey.length > 200) {
    errors.push("Idempotency key must be 1–200 characters.");
  }
  if (!Array.isArray(input?.transcript)) {
    errors.push("Transcript must be an ordered array.");
  } else if (input.transcript.length > 200) {
    errors.push("Transcript cannot exceed 200 messages.");
  } else {
    const ids = new Set();
    let totalCharacters = 0;
    for (const message of input.transcript) {
      if (
        !message ||
        typeof message !== "object" ||
        Array.isArray(message) ||
        !String(message.id || "").trim() ||
        ids.has(message.id) ||
        !["learner", "agent"].includes(message.role) ||
        typeof message.content !== "string" ||
        message.content.length > 20_000 ||
        !["sent", "failed"].includes(message.status) ||
        !Number.isFinite(new Date(message.createdAt).getTime())
      ) {
        errors.push("Transcript contains a malformed or duplicate message.");
        break;
      }
      ids.add(message.id);
      totalCharacters += message.content.length;
    }
    if (totalCharacters > 200_000) {
      errors.push("Transcript cannot exceed 200,000 characters.");
    }
  }
  if (
    typeof input?.workProduct !== "string" ||
    input.workProduct.length > 200_000
  ) {
    errors.push("Work product must be text no longer than 200,000 characters.");
  }
  if (
    input?.predecessorAttemptId &&
    (typeof input.predecessorAttemptId !== "string" ||
      input.predecessorAttemptId.length > 200)
  ) {
    errors.push("Predecessor attempt ID is invalid.");
  }
  return errors;
}

function privateToken(participantId, version = 1) {
  return derivePrivateToken(
    participantId,
    version,
    PRIVATE_TOKEN_SECRET.value(),
  );
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function sendError(res, status, message) {
  res.status(status).json({ error: message });
}

async function enforceRateLimit(key, limit, windowMs) {
  const ref = db.collection("rateLimits").doc(hash(key));
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const current = snapshot.data();
    const windowStartedAt = current?.windowStartedAt
      ? new Date(current.windowStartedAt).getTime()
      : 0;
    const withinWindow = Date.now() - windowStartedAt < windowMs;
    const count = withinWindow ? current.count || 0 : 0;
    if (count >= limit) {
      const error = new Error("Too many requests. Try again later.");
      error.status = 429;
      throw error;
    }
    transaction.set(ref, {
      count: count + 1,
      windowStartedAt: withinWindow ? current.windowStartedAt : iso(),
      expiresAt: new Date(Date.now() + windowMs).toISOString(),
    });
  });
}

async function recordEvent(type, data) {
  await db.collection("evaluationEvents").add({
    type,
    ...data,
    recordedAt: iso(),
  });
}

const ATTEMPT_STATUSES = new Set([
  "ai_processing",
  "ready_for_review",
  "ai_failed",
  "in_review",
  "pass",
  "remediation_required",
  "not_yet_ready",
]);
const SHARED_OUTCOMES = new Set([
  "pass",
  "remediation_required",
  "not_yet_ready",
]);

function queryValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function filterAttemptsForQuery(attempts, query = {}) {
  const caseId = queryValue(query.caseId);
  const status = queryValue(query.status);
  const recommendation = queryValue(query.recommendation);
  const submittedAfter = queryValue(query.submittedAfter);
  const submittedBefore = queryValue(query.submittedBefore);
  if (caseId.length > 120) {
    const error = new Error("caseId query is too long.");
    error.status = 400;
    throw error;
  }
  if (status && !ATTEMPT_STATUSES.has(status)) {
    const error = new Error("Unknown attempt status.");
    error.status = 400;
    throw error;
  }
  if (recommendation && !SHARED_OUTCOMES.has(recommendation)) {
    const error = new Error("Unknown evaluation recommendation.");
    error.status = 400;
    throw error;
  }
  const afterMs = submittedAfter ? Date.parse(submittedAfter) : null;
  const beforeMs = submittedBefore ? Date.parse(submittedBefore) : null;
  if (
    (submittedAfter && !Number.isFinite(afterMs)) ||
    (submittedBefore && !Number.isFinite(beforeMs)) ||
    (afterMs !== null && beforeMs !== null && afterMs > beforeMs)
  ) {
    const error = new Error("Invalid submission date range.");
    error.status = 400;
    throw error;
  }
  return attempts.filter((attempt) => {
    const latestRecommendation = [...(attempt.evaluationRuns || [])]
      .reverse()
      .find((run) => run.status === "completed")?.recommendation;
    const submittedAtMs = Date.parse(attempt.submittedAt);
    return (
      (!caseId || attempt.caseId === caseId) &&
      (!status || attempt.status === status) &&
      (!recommendation || latestRecommendation === recommendation) &&
      (afterMs === null || submittedAtMs >= afterMs) &&
      (beforeMs === null || submittedAtMs <= beforeMs)
    );
  });
}

function scoreReview(caseDefinition, scores) {
  const byId = new Map(scores.map((score) => [score.criterionId, score]));
  let caseScore = 0;
  let interactionScore = 0;
  let criticalFailure = false;
  for (const [criterionId, dimension, maxPoints, critical] of caseDefinition.criteria) {
    const points = Math.max(0, Math.min(maxPoints, Number(byId.get(criterionId)?.points ?? 0)));
    if (dimension === "case_outcome") caseScore += points;
    else interactionScore += points;
    if (critical && points === 0) criticalFailure = true;
  }
  const casePassed = caseScore >= caseDefinition.caseThreshold;
  const interactionPassed = interactionScore >= caseDefinition.interactionThreshold;
  const outcome =
    casePassed && interactionPassed && !criticalFailure
      ? "pass"
      : casePassed || interactionPassed
        ? "remediation_required"
        : "not_yet_ready";
  return { caseScore, interactionScore, outcome };
}

function validateDraft(attempt, draft) {
  const definition = CASES[attempt.caseId];
  if (!definition) return ["Unknown case rubric."];
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) {
    return ["Review draft is required."];
  }
  const errors = [];
  const latestCompleted = [...(attempt.evaluationRuns || [])].reverse().find((run) => run.status === "completed");
  const aiById = new Map((latestCompleted?.assessments || []).map((item) => [item.criterionId, item]));
  const scores = Array.isArray(draft.scores) ? draft.scores : [];
  if (!Array.isArray(draft.scores)) errors.push("Human scores must be an array.");
  const expectedIds = new Set(
    definition.criteria.map(([criterionId]) => criterionId),
  );
  const scoreById = new Map();
  for (const score of scores) {
    if (!score || typeof score !== "object" || Array.isArray(score)) {
      errors.push("Every human score must be a structured object.");
      continue;
    }
    if (!expectedIds.has(score.criterionId)) {
      errors.push(`Unknown human score criterion: ${score.criterionId}.`);
      continue;
    }
    if (scoreById.has(score.criterionId)) {
      errors.push(`Duplicate human score criterion: ${score.criterionId}.`);
      continue;
    }
    if (String(score.note || "").length > 5_000) {
      errors.push(`${score.criterionId}: evaluator note is too long.`);
    }
    if (String(score.overrideReason || "").length > 2_000) {
      errors.push(`${score.criterionId}: override reason is too long.`);
    }
    scoreById.set(score.criterionId, score);
  }
  for (const [criterionId, , maxPoints] of definition.criteria) {
    const score = scoreById.get(criterionId);
    if (
      !score ||
      typeof score.points !== "number" ||
      !Number.isFinite(score.points) ||
      score.points < 0 ||
      score.points > maxPoints
    ) {
      errors.push(`${criterionId}: valid human score required.`);
      continue;
    }
    const ai = aiById.get(criterionId);
    if (ai && ai.points !== score.points && !String(score.overrideReason || "").trim()) {
      errors.push(`${criterionId}: override reason required.`);
    }
  }
  const calculated = scoreReview(
    definition,
    [...scoreById.values()],
  ).outcome;
  if (
    !["pass", "remediation_required", "not_yet_ready"].includes(draft.outcome)
  ) {
    errors.push("A valid final outcome is required.");
  } else if (draft.outcome !== calculated && !String(draft.outcomeOverrideReason || "").trim()) {
    errors.push("Outcome override reason required.");
  }
  if (!String(draft.summary || "").trim()) errors.push("Evaluator summary required.");
  if (String(draft.summary || "").length > 5_000) {
    errors.push("Evaluator summary cannot exceed 5,000 characters.");
  }
  if (String(draft.outcomeOverrideReason || "").length > 2_000) {
    errors.push("Outcome override reason cannot exceed 2,000 characters.");
  }
  if (String(draft.supplementalLabel || "").length > 80) {
    errors.push("Supplemental label cannot exceed 80 characters.");
  }
  if (
    draft.outcome !== "pass" &&
    String(draft.supplementalLabel || "").trim()
  ) {
    errors.push("Supplemental labels are available only for passing outcomes.");
  }
  return errors;
}

function stampedScores(attempt, evaluatorName, scores) {
  const latestCompleted = [...(attempt.evaluationRuns || [])]
    .reverse()
    .find((run) => run.status === "completed");
  const aiById = new Map(
    (latestCompleted?.assessments || []).map((item) => [
      item.criterionId,
      item.points,
    ]),
  );
  const overriddenAt = iso();
  return (scores || []).map((score) =>
    aiById.has(score.criterionId) &&
    aiById.get(score.criterionId) !== score.points
      ? { ...score, overriddenBy: evaluatorName, overriddenAt }
      : score,
  );
}

function sourceLocatorResolves(artifact, locator) {
  const value = String(locator || "").trim();
  const content = String(artifact?.content || "");
  if (!value || !content) return false;
  if (content.includes(value)) return true;
  const numbered = value.match(/\b(?:row|item|page)\s+(\d+)\b/i);
  if (!numbered) return false;
  const number = Number(numbered[1]);
  const lines = content.split(/\r?\n/).filter((line) => line.trim());
  return Number.isInteger(number) && number >= 1 && number <= lines.length;
}

function validateEvaluationResult(attempt, result) {
  const definition = CASES[attempt.caseId];
  const errors = [];
  if (!definition) return ["Unknown case rubric."];
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return ["Evaluation result must be a structured object."];
  }
  if (!Array.isArray(result.assessments)) {
    return ["Evaluation result assessments must be an array."];
  }
  const transcriptById = new Map(
    attempt.transcript.map((message) => [message.id, message]),
  );
  const artifactIds = new Set(attempt.sourceArtifacts.map((artifact) => artifact.id));
  const artifactsById = new Map(
    (definition.artifacts || []).map((artifact) => [artifact.id, artifact]),
  );
  const criteriaById = new Map(
    definition.criteria.map(([criterionId, dimension, maxPoints]) => [
      criterionId,
      { dimension, maxPoints },
    ]),
  );
  const expectedIds = new Set(criteriaById.keys());
  const seen = new Set();
  for (const assessment of result.assessments) {
    if (!assessment || typeof assessment !== "object" || Array.isArray(assessment)) {
      errors.push("Every assessment must be a structured object.");
      continue;
    }
    if (seen.has(assessment.criterionId)) {
      assessment.supported = false;
      errors.push(`Duplicate criterion ${assessment.criterionId}.`);
      continue;
    }
    seen.add(assessment.criterionId);
    const criterion = criteriaById.get(assessment.criterionId);
    if (!criterion) {
      assessment.supported = false;
      errors.push(`Unknown criterion ${assessment.criterionId}.`);
      continue;
    }
    const points = Number(assessment.points);
    if (!Number.isFinite(points) || points < 0 || points > criterion.maxPoints) {
      assessment.supported = false;
      errors.push(
        `${assessment.criterionId}: points must be between 0 and ${criterion.maxPoints}.`,
      );
    }
    if (!String(assessment.explanation || "").trim()) {
      errors.push(`${assessment.criterionId}: explanation is required.`);
    }
    if (!Array.isArray(assessment.evidence)) {
      assessment.evidence = [];
      errors.push(`${assessment.criterionId}: evidence must be an array.`);
    }
    for (const evidence of assessment.evidence) {
      const evidenceObject =
        evidence && typeof evidence === "object" && !Array.isArray(evidence);
      if (!evidenceObject) {
        errors.push(`${assessment.criterionId}: evidence must be a structured object.`);
        continue;
      }
      const hasTranscriptReference = Boolean(evidence.messageId);
      const hasArtifactReference = Boolean(evidence.source?.artifactId);
      const transcriptMessage = hasTranscriptReference
        ? transcriptById.get(evidence.messageId)
        : undefined;
      const transcriptOk =
        !hasTranscriptReference ||
        (Boolean(transcriptMessage) &&
          Boolean(String(evidence.excerpt || "").trim()) &&
          transcriptMessage.content.includes(String(evidence.excerpt)));
      const sourceOk =
        !hasArtifactReference ||
        (artifactIds.has(evidence.source.artifactId) &&
          sourceLocatorResolves(
            artifactsById.get(evidence.source.artifactId),
            evidence.source.locator,
          ));
      const excerptOk = Boolean(String(evidence.excerpt || "").trim());
      const connectionOk = Boolean(String(evidence.connection || "").trim());
      evidence.resolved =
        (hasTranscriptReference || hasArtifactReference) &&
        transcriptOk &&
        sourceOk &&
        excerptOk &&
        connectionOk;
      if (assessment.points > 0 && !evidence.resolved) assessment.supported = false;
    }
    if (points > 0 && !assessment.evidence.some((item) => item?.resolved)) {
      assessment.supported = false;
      errors.push(`${assessment.criterionId}: awarded points lack resolvable evidence.`);
    }
    if (
      points > 0 &&
      !assessment.evidence.some(
        (item) => item?.resolved && item.messageId,
      )
    ) {
      assessment.supported = false;
      errors.push(
        `${assessment.criterionId}: awarded points require exact transcript evidence.`,
      );
    }
    if (
      points > 0 &&
      criterion.dimension === "case_outcome" &&
      !assessment.evidence.some(
        (item) => item?.resolved && item.source?.artifactId,
      )
    ) {
      assessment.supported = false;
      errors.push(
        `${assessment.criterionId}: case-outcome points require a source locator.`,
      );
    }
  }
  for (const criterionId of expectedIds) {
    if (!seen.has(criterionId)) errors.push(`Missing criterion ${criterionId}.`);
  }
  return errors;
}

async function runAutomaticEvaluation(attempt, parentRunId) {
  const runId = id("run");
  const startedAt = iso();
  const definition = CASES[attempt.caseId];
  const baseRun = {
    id: runId,
    attemptId: attempt.id,
    ...(parentRunId ? { parentRunId } : {}),
    provider: process.env.EVALUATION_PROVIDER || "unconfigured",
    model: process.env.EVALUATION_MODEL || "unconfigured",
    promptVersion: process.env.EVALUATION_PROMPT_VERSION || "1.0.0",
    caseVersion: attempt.caseVersion,
    rubricVersion: attempt.rubricVersion,
    startedAt,
    status: "processing",
    assessments: [],
    caseScore: 0,
    interactionScore: 0,
    validationErrors: [],
    materialRuntimeSettings: {
      temperature: process.env.EVALUATION_TEMPERATURE || "provider-default",
      maxOutputTokens:
        process.env.EVALUATION_MAX_OUTPUT_TOKENS || "provider-default",
    },
  };
  const attemptRef = db.collection("attempts").doc(attempt.id);
  await attemptRef.update({
    evaluationRuns: [...attempt.evaluationRuns, baseRun],
    status: "ai_processing",
  });
  await recordEvent("evaluation_started", {
    attemptId: attempt.id,
    caseId: attempt.caseId,
    runId,
    retry: Boolean(parentRunId),
  });

  const endpoint = process.env.EVALUATION_ENDPOINT;
  if (!endpoint) {
    const failed = {
      ...baseRun,
      completedAt: iso(),
      status: "failed",
      validationErrors: ["EVALUATION_ENDPOINT is not configured."],
    };
    await attemptRef.update({
      evaluationRuns: [...attempt.evaluationRuns, failed],
      status: attempt.claim ? "in_review" : "ai_failed",
    });
    await recordEvent("evaluation_failed", {
      attemptId: attempt.id,
      caseId: attempt.caseId,
      runId,
      reason: "provider_not_configured",
    });
    return failed;
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${EVALUATION_API_KEY.value()}`,
      },
      body: JSON.stringify({
        attempt,
        sourceArtifacts: definition.artifacts,
        caseInstructions: definition.caseInstructions,
        evaluationGuidance: definition.evaluationGuidance,
        rubric: definition.structuredRubric,
        evaluationPrompt: definition.evaluationPrompt,
        promptVersion: baseRun.promptVersion,
      }),
      signal: AbortSignal.timeout(
        Number(process.env.EVALUATION_TIMEOUT_MS || 90_000),
      ),
    });
    if (!response.ok) throw new Error(`Evaluator provider returned ${response.status}.`);
    const rawResult = await response.json();
    const result =
      rawResult && typeof rawResult === "object" && !Array.isArray(rawResult)
        ? rawResult
        : { assessments: [], malformedResult: rawResult };
    const validationErrors = validateEvaluationResult(attempt, result);
    const supportedAssessments = (
      Array.isArray(result.assessments) ? result.assessments : []
    ).map((assessment) =>
      assessment?.supported === false
        ? { ...assessment, points: 0 }
        : assessment,
    );
    const totals = scoreReview(
      definition,
      supportedAssessments.map((item) => ({ criterionId: item.criterionId, points: item.points })),
    );
    const completed = {
      ...baseRun,
      completedAt: iso(),
      status: validationErrors.length ? "invalid" : "completed",
      assessments: supportedAssessments,
      caseScore: totals.caseScore,
      interactionScore: totals.interactionScore,
      recommendation: totals.outcome,
      criticalFailures: result.criticalFailures || [],
      validationStatus: validationErrors.length ? "invalid" : "valid",
      validationErrors,
      rawStructuredResult: result,
    };
    await attemptRef.update({
      evaluationRuns: [...attempt.evaluationRuns, completed],
      status: attempt.claim
        ? "in_review"
        : validationErrors.length
          ? "ai_failed"
          : "ready_for_review",
    });
    await recordEvent(
      validationErrors.length ? "evaluation_invalid" : "evaluation_completed",
      {
        attemptId: attempt.id,
        caseId: attempt.caseId,
        runId,
        durationMs: Date.now() - new Date(startedAt).getTime(),
      },
    );
    return completed;
  } catch (error) {
    const failed = {
      ...baseRun,
      completedAt: iso(),
      status: "failed",
      validationErrors: [error.message],
    };
    await attemptRef.update({
      evaluationRuns: [...attempt.evaluationRuns, failed],
      status: attempt.claim ? "in_review" : "ai_failed",
    });
    await recordEvent("evaluation_failed", {
      attemptId: attempt.id,
      caseId: attempt.caseId,
      runId,
      reason: "provider_error",
    });
    return failed;
  }
}

async function claimEvaluationJob(jobRef) {
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(jobRef);
    if (!snapshot.exists) return null;
    const job = snapshot.data();
    if (job.status === "completed" || job.status === "failed") return null;
    const leaseActive =
      job.status === "processing" &&
      new Date(job.leaseExpiresAt || 0).getTime() > Date.now();
    if (leaseActive) return null;
    transaction.update(jobRef, {
      status: "processing",
      startedAt: job.startedAt || iso(),
      leaseExpiresAt: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
      attempts: (job.attempts || 0) + 1,
    });
    return job;
  });
}

async function evaluatorSession(req) {
  const authorization = req.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return null;
  const snapshot = await db.collection("evaluatorSessions").doc(hash(token)).get();
  if (!snapshot.exists) return null;
  const session = snapshot.data();
  if (new Date(session.expiresAt).getTime() <= Date.now()) return null;
  return session;
}

async function requireEvaluator(req, res) {
  const session = await evaluatorSession(req);
  if (!session) sendError(res, 401, "A valid evaluator session is required.");
  return session;
}

async function resolvePrivateAccess(token) {
  const grant = await db.collection("privateAccessGrants").doc(hash(token)).get();
  if (!grant.exists || grant.data().revoked) return null;
  return grant.data();
}

async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  const path = req.path
    .replace(/^\/api\/evaluation\/?/, "")
    .replace(/^\/+|\/+$/g, "");
  const parts = path ? path.split("/") : [];

  if (req.method === "POST" && path === "evaluator/session") {
    await enforceRateLimit(`evaluator-session:${req.ip}`, 10, 15 * 60 * 1000);
    const { code, evaluatorName } = req.body || {};
    const configuredCode = EVALUATOR_ACCESS_CODE.value();
    if (!configuredCode || !safeEqual(code || "", configuredCode)) {
      sendError(res, 403, "Invalid evaluator access code.");
      return;
    }
    if (!String(evaluatorName || "").trim()) {
      sendError(res, 400, "Evaluator display name is required.");
      return;
    }
    const token = id("eval");
    const session = {
      evaluatorName: String(evaluatorName).trim(),
      expiresAt: new Date(Date.now() + SESSION_MS).toISOString(),
      createdAt: iso(),
    };
    await db.collection("evaluatorSessions").doc(hash(token)).set(session);
    res.json({ token, ...session });
    return;
  }

  if (req.method === "POST" && path === "attempts") {
    await enforceRateLimit(`attempt-submit:${req.ip}`, 20, 60 * 60 * 1000);
    const input = req.body || {};
    const definition = CASES[input.caseId];
    if (!definition || !definition.released) {
      sendError(res, 400, "Case is not released.");
      return;
    }
    const inputErrors = validateSubmissionInput(input);
    if (inputErrors.length) {
      sendError(res, 400, inputErrors.join("\n"));
      return;
    }
    const idemRef = db.collection("idempotencyKeys").doc(hash(`${input.participantId}:${input.idempotencyKey}`));
    const counterRef = db.collection("attemptCounters").doc(hash(`${input.participantId}:${input.caseId}`));
    const participantRef = db.collection("participants").doc(input.participantId);
    const result = await db.runTransaction(async (transaction) => {
      const idem = await transaction.get(idemRef);
      const participantSnapshot = await transaction.get(participantRef);
      const privateTokenVersion =
        participantSnapshot.data()?.privateTokenVersion || 1;
      const token = privateToken(input.participantId, privateTokenVersion);
      const grantRef = db.collection("privateAccessGrants").doc(hash(token));
      if (idem.exists) {
        const existing = await transaction.get(db.collection("attempts").doc(idem.data().attemptId));
        return {
          attempt: existing.data(),
          created: false,
          privateTokenVersion,
        };
      }
      if (input.predecessorAttemptId) {
        const predecessor = await transaction.get(
          db.collection("attempts").doc(input.predecessorAttemptId),
        );
        const predecessorData = predecessor.data();
        if (
          !predecessor.exists ||
          predecessorData.participantId !== input.participantId ||
          predecessorData.caseId !== input.caseId
        ) {
          const predecessorError = new Error(
            "Predecessor attempt must belong to the same learner and case.",
          );
          predecessorError.status = 400;
          throw predecessorError;
        }
      }
      const counter = await transaction.get(counterRef);
      const attemptNumber = (counter.data()?.count || 0) + 1;
      const attemptId = id("att");
      const submittedAt = iso();
      const attempt = {
        id: attemptId,
        participantId: input.participantId,
        learnerDisplayName: String(input.displayName).trim(),
        caseId: definition.id,
        caseTitle: definition.title,
        category: definition.category,
        caseVersion: definition.version,
        rubricVersion: definition.rubricVersion,
        evaluationMode: definition.evaluationMode,
        attemptNumber,
        ...(input.predecessorAttemptId ? { predecessorAttemptId: input.predecessorAttemptId } : {}),
        transcript: input.transcript,
        workProduct: String(input.workProduct || ""),
        sourceArtifacts: definition.artifacts.map((artifact) => ({
          id: artifact.id,
          version: artifact.version,
        })),
        submissionMetadata: submissionMetadata(
          input.transcript,
          input.workProduct,
          definition.artifacts,
        ),
        submittedAt,
        idempotencyKey: input.idempotencyKey,
        status: "ai_processing",
        evaluationRuns: [],
      };
      transaction.create(db.collection("attempts").doc(attemptId), attempt);
      transaction.set(counterRef, { count: attemptNumber });
      transaction.create(idemRef, { attemptId, createdAt: submittedAt });
      transaction.set(participantRef, {
        displayName: String(input.displayName).trim(),
        email: String(input.email).trim(),
        privateTokenVersion,
        updatedAt: submittedAt,
      }, { merge: true });
      transaction.set(
        grantRef,
        {
          participantId: input.participantId,
          privateTokenVersion,
          revoked: false,
          createdAt: submittedAt,
        },
        { merge: true },
      );
      transaction.create(db.collection("notifications").doc(`receipt:${attemptId}`), {
        id: `receipt:${attemptId}`,
        kind: "submission_receipt",
        attemptId,
        status: "queued",
        createdAt: submittedAt,
      });
      transaction.create(
        db.collection("evaluationJobs").doc(`initial:${attemptId}`),
        {
          id: `initial:${attemptId}`,
          attemptId,
          status: "queued",
          createdAt: submittedAt,
        },
      );
      return { attempt, created: true, privateTokenVersion };
    });
    await recordEvent("submission_succeeded", {
      attemptId: result.attempt.id,
      caseId: result.attempt.caseId,
      idempotentRetry: !result.created,
    });
    const current = await db.collection("attempts").doc(result.attempt.id).get();
    const notification = await db.collection("notifications").doc(`receipt:${result.attempt.id}`).get();
    res.json({
      attempt: current.data(),
      access: {
        participantId: input.participantId,
        displayName: String(input.displayName).trim(),
        email: String(input.email).trim(),
        privateToken: privateToken(
          input.participantId,
          result.privateTokenVersion,
        ),
      },
      notification: notification.data(),
    });
    return;
  }

  if (req.method === "GET" && path === "attempts") {
    if (!(await requireEvaluator(req, res))) return;
    const snapshot = await db.collection("attempts").get();
    res.json(
      filterAttemptsForQuery(
        snapshot.docs.map((doc) => doc.data()),
        req.query,
      ),
    );
    return;
  }

  if (parts[0] === "attempts" && parts[1]) {
    const session = await requireEvaluator(req, res);
    if (!session) return;
    const attemptRef = db.collection("attempts").doc(parts[1]);
    if (req.method === "GET" && parts.length === 2) {
      const snapshot = await attemptRef.get();
      res.json(snapshot.exists ? snapshot.data() : null);
      return;
    }
    if (req.method === "POST" && parts[2] === "evaluation-runs") {
      const queued = await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(attemptRef);
        if (!snapshot.exists) throw new Error("Attempt not found.");
        const attempt = snapshot.data();
        if (attempt.review?.status === "final") {
          throw new Error("Finalized attempts cannot be re-evaluated.");
        }
        if (attempt.status === "ai_processing") {
          throw new Error("An evaluation run is already processing.");
        }
        const parent = attempt.evaluationRuns[attempt.evaluationRuns.length - 1];
        const jobId = id("evaluationJob");
        transaction.update(attemptRef, { status: "ai_processing" });
        transaction.create(db.collection("evaluationJobs").doc(jobId), {
          id: jobId,
          attemptId: attempt.id,
          parentRunId: parent?.id || null,
          status: "queued",
          createdAt: iso(),
        });
        return { ...attempt, status: "ai_processing" };
      });
      res.status(202).json(queued);
      return;
    }
    if (parts[2] === "claim") {
      if (req.method === "POST") {
        const { evaluatorName, takeover } = req.body || {};
        if (evaluatorName !== session.evaluatorName) return sendError(res, 403, "Evaluator attribution mismatch.");
        const updated = await db.runTransaction(async (transaction) => {
          const snapshot = await transaction.get(attemptRef);
          if (!snapshot.exists) throw new Error("Attempt not found.");
          const attempt = snapshot.data();
          if (attempt.review?.status === "final") {
            throw new Error("Finalized attempts are read-only.");
          }
          if (attempt.status === "ai_processing") {
            throw new Error("AI evaluation is still processing.");
          }
          const active = attempt.claim && new Date(attempt.claim.expiresAt).getTime() > Date.now();
          if (active && attempt.claim.evaluatorName !== evaluatorName && !takeover) {
            throw new Error(`This review is currently claimed by ${attempt.claim.evaluatorName}.`);
          }
          const history = attempt.claim?.takeoverHistory || [];
          if (active && attempt.claim.evaluatorName !== evaluatorName && takeover) {
            history.push({ from: attempt.claim.evaluatorName, to: evaluatorName, at: iso() });
          }
          const claim = {
            evaluatorName,
            claimedAt: attempt.claim?.evaluatorName === evaluatorName ? attempt.claim.claimedAt : iso(),
            expiresAt: new Date(Date.now() + CLAIM_MS).toISOString(),
            takeoverHistory: history,
          };
          transaction.update(attemptRef, { claim, status: "in_review" });
          return { ...attempt, claim, status: "in_review" };
        });
        res.json(updated);
        return;
      }
      if (req.method === "DELETE") {
        const released = await db.runTransaction(async (transaction) => {
          const snapshot = await transaction.get(attemptRef);
          if (!snapshot.exists) {
            const error = new Error("Attempt not found.");
            error.status = 404;
            throw error;
          }
          const attempt = snapshot.data();
          if (attempt.claim?.evaluatorName !== session.evaluatorName) {
            return attempt;
          }
          const status = statusAfterClaimRelease(attempt);
          transaction.update(attemptRef, { claim: null, status });
          const next = { ...attempt, status };
          delete next.claim;
          return next;
        });
        res.json(released);
        return;
      }
    }
    if (req.method === "PUT" && parts[2] === "review") {
      const { evaluatorName, draft } = req.body || {};
      if (evaluatorName !== session.evaluatorName) return sendError(res, 403, "Evaluator attribution mismatch.");
      const saved = await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(attemptRef);
        if (!snapshot.exists) {
          const error = new Error("Attempt not found.");
          error.status = 404;
          throw error;
        }
        const attempt = snapshot.data();
        if (
          !attempt.claim ||
          attempt.claim.evaluatorName !== evaluatorName ||
          new Date(attempt.claim.expiresAt).getTime() <= Date.now()
        ) {
          const error = new Error("Review claim lost.");
          error.status = 409;
          throw error;
        }
        const errors = validateDraft(attempt, draft);
        if (errors.length) {
          const error = new Error(errors.join("\n"));
          error.status = 400;
          throw error;
        }
        const claim = {
          ...attempt.claim,
          expiresAt: new Date(Date.now() + CLAIM_MS).toISOString(),
        };
        const review = {
          version: attempt.review?.version || 1,
          status: "draft",
          evaluatorName,
          ...draft,
          scores: stampedScores(attempt, evaluatorName, draft.scores),
          savedAt: iso(),
        };
        transaction.update(attemptRef, { review, claim });
        return { ...attempt, review, claim };
      });
      res.json(saved);
      return;
    }
    if (req.method === "POST" && parts[2] === "finalize") {
      const { evaluatorName, draft } = req.body || {};
      if (evaluatorName !== session.evaluatorName) return sendError(res, 403, "Evaluator attribution mismatch.");
      const finalized = await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(attemptRef);
        if (!snapshot.exists) throw new Error("Attempt not found.");
        const attempt = snapshot.data();
        const reviewVersion = attempt.review?.version || 1;
        const notificationRef = db.collection("notifications").doc(`result:${attempt.id}:${reviewVersion}`);
        const credentialRef = db.collection("credentials").doc(`cred_${attempt.id}`);
        if (attempt.review?.status === "final") {
          const notification = await transaction.get(notificationRef);
          const credential = await transaction.get(credentialRef);
          return { attempt, notification: notification.data(), credential: credential.exists ? credential.data() : undefined };
        }
        if (!attempt.claim || attempt.claim.evaluatorName !== evaluatorName || new Date(attempt.claim.expiresAt).getTime() <= Date.now()) {
          throw new Error("Review claim lost.");
        }
        const errors = validateDraft(attempt, draft);
        if (errors.length) {
          const validationError = new Error(errors.join("\n"));
          validationError.status = 400;
          throw validationError;
        }
        const finalizedAt = iso();
        const review = {
          version: reviewVersion,
          status: "final",
          evaluatorName,
          ...draft,
          scores: stampedScores(attempt, evaluatorName, draft.scores),
          savedAt: finalizedAt,
          finalizedAt,
        };
        const notification = { id: notificationRef.id, kind: "result", attemptId: attempt.id, reviewVersion, status: "queued", createdAt: finalizedAt };
        const finalAttempt = { ...attempt, review, status: draft.outcome };
        delete finalAttempt.claim;
        transaction.set(attemptRef, finalAttempt);
        transaction.create(notificationRef, notification);
        let credential;
        if (draft.outcome === "pass") {
          credential = {
            id: credentialRef.id,
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
            ...(draft.supplementalLabel
              ? { supplementalLabel: String(draft.supplementalLabel).trim() }
              : {}),
            status: "private",
          };
          transaction.create(credentialRef, credential);
        }
        transaction.create(db.collection("evaluationEvents").doc(id("event")), {
          type: "review_finalized",
          attemptId: attempt.id,
          caseId: attempt.caseId,
          outcome: draft.outcome,
          aiRecommendation:
            [...(attempt.evaluationRuns || [])]
              .reverse()
              .find((run) => run.status === "completed")?.recommendation || null,
          criterionOverrideCount: review.scores.filter(
            (score) => score.overriddenBy,
          ).length,
          submitToFinalMs:
            new Date(finalizedAt).getTime() -
            new Date(attempt.submittedAt).getTime(),
          recordedAt: finalizedAt,
        });
        return { attempt: finalAttempt, notification, credential };
      });
      res.json(finalized);
      return;
    }
  }

  if (
    req.method === "POST" &&
    parts[0] === "notifications" &&
    parts[1] &&
    parts[2] === "retry"
  ) {
    if (!(await requireEvaluator(req, res))) return;
    const notificationRef = db.collection("notifications").doc(parts[1]);
    const snapshot = await notificationRef.get();
    if (!snapshot.exists) {
      return sendError(res, 404, "Notification not found.");
    }
    const notification = snapshot.data();
    if (notification.status !== "sent") {
      await notificationRef.update({
        status: "queued",
        nextAttemptAt: iso(),
        leaseExpiresAt: null,
        error: null,
        operatorRetryAt: iso(),
      });
    }
    res.json({
      ...notification,
      status: notification.status === "sent" ? "sent" : "queued",
    });
    return;
  }

  if (req.method === "POST" && path === "credentials/private/resolve") {
    const token = req.body?.privateToken;
    if (!token || typeof token !== "string" || token.length > 200) {
      return sendError(res, 400, "Private access token is required.");
    }
    await enforceRateLimit(`private-resolve:${req.ip}:${hash(token)}`, 60, 15 * 60 * 1000);
    const grant = await resolvePrivateAccess(token);
    if (!grant) {
      res.json(null);
      return;
    }
    const [participant, attemptsSnap, credentialsSnap] = await Promise.all([
      db.collection("participants").doc(grant.participantId).get(),
      db.collection("attempts").where("participantId", "==", grant.participantId).get(),
      db.collection("credentials").where("participantId", "==", grant.participantId).get(),
    ]);
    const attemptsData = attemptsSnap.docs.map((doc) => doc.data());

    // Also look up evaluations linked by attemptId (written by submission-evaluator).
    // These may reflect a completed AI evaluation that the attempt record hasn't captured.
    const attemptIds = attemptsData.map((a) => a.id).filter(Boolean);
    const evalsByAttemptId = new Map();
    if (attemptIds.length > 0) {
      const evSnap = await db.collection("evaluations")
        .where("attemptId", "in", attemptIds.slice(0, 30))
        .get();
      for (const doc of evSnap.docs) {
        const ev = doc.data();
        if (ev.attemptId) evalsByAttemptId.set(ev.attemptId, ev);
      }
    }

    const mergedAttempts = attemptsData.map((attempt) => {
      const ev = evalsByAttemptId.get(attempt.id);
      if (!ev) return attempt;
      // If the attempt is stuck at ai_failed but the linked evaluation succeeded,
      // promote the status and surface its runs so the UI reflects reality.
      if (attempt.status === "ai_failed" && ev.status === "ready_for_review") {
        return {
          ...attempt,
          status: "ready_for_review",
          evaluationRuns: [...(attempt.evaluationRuns || []), ...(ev.evaluationRuns || [])],
        };
      }
      return attempt;
    });

    const data = participant.data();
    res.json({
      access: { participantId: grant.participantId, displayName: data.displayName, email: data.email, privateToken: token },
      attempts: mergedAttempts,
      credentials: credentialsSnap.docs.map((doc) => doc.data()),
    });
    return;
  }

  if (req.method === "POST" && path === "credentials/by-email") {
    await enforceRateLimit(`by-email:${req.ip}`, 20, 60 * 60 * 1000);
    const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
    if (!email) return sendError(res, 400, "email is required.");

    // Wave 1: submissions is the primary source (always has email directly).
    const submissionsSnap = await db.collection("submissions").where("email", "==", email).get();
    if (submissionsSnap.empty) { res.json(null); return; }

    // Deduplicate by attemptId.
    const seen = new Set();
    const submissionDocs = submissionsSnap.docs
      .map((d) => ({ _docId: d.id, ...d.data() }))
      .filter((s) => { const key = s.attemptId || s._docId; if (seen.has(key)) return false; seen.add(key); return true; });

    const attemptIds = [...new Set(submissionDocs.map((s) => s.attemptId).filter(Boolean))];
    const submissionDocIds = submissionDocs.map((s) => s._docId);

    // Wave 2: fire all enrichment queries in parallel.
    // attempts uses "id" field (stored on the doc) so we can batch instead of N getDoc calls.
    const [attemptsSnap, evByAttemptSnap, evBySubmissionSnap, participantsSnap] = await Promise.all([
      attemptIds.length > 0
        ? db.collection("attempts").where("id", "in", attemptIds.slice(0, 30)).get()
        : Promise.resolve({ docs: [] }),
      attemptIds.length > 0
        ? db.collection("evaluations").where("attemptId", "in", attemptIds.slice(0, 30)).get()
        : Promise.resolve({ docs: [] }),
      submissionDocIds.length > 0
        ? db.collection("evaluations").where("submissionId", "in", submissionDocIds.slice(0, 30)).get()
        : Promise.resolve({ docs: [] }),
      db.collection("participants").where("email", "==", email).get(),
    ]);

    const attemptsById = new Map(attemptsSnap.docs.map((d) => [d.data().id, d.data()]));
    const evalsByAttemptId = new Map();
    evByAttemptSnap.docs.forEach((d) => { const ev = d.data(); if (ev.attemptId) evalsByAttemptId.set(ev.attemptId, ev); });
    const evalsBySubmissionId = new Map();
    evBySubmissionSnap.docs.forEach((d) => { const ev = d.data(); if (ev.submissionId) evalsBySubmissionId.set(ev.submissionId, ev); });

    // Resolve participantId from participants query or from any full attempt.
    let participantId = null;
    let displayName = submissionDocs[0].displayName || email;
    if (!participantsSnap.empty) {
      const pd = participantsSnap.docs[0];
      participantId = pd.id;
      displayName = pd.data().displayName || displayName;
    } else {
      for (const attempt of attemptsById.values()) {
        if (attempt.participantId) { participantId = attempt.participantId; displayName = attempt.learnerDisplayName || displayName; break; }
      }
    }

    // Wave 3 (conditional): credentials require participantId.
    let credentialsData = [];
    let token = "";
    if (participantId) {
      const [credSnap, participantSnap] = await Promise.all([
        db.collection("credentials").where("participantId", "==", participantId).get(),
        db.collection("participants").doc(participantId).get(),
      ]);
      credentialsData = credSnap.docs.map((d) => d.data());
      if (participantSnap.exists) {
        const pd = participantSnap.data();
        token = privateToken(participantId, pd.privateTokenVersion || 1);
        displayName = pd.displayName || displayName;
      }
    }

    // Build attempts, preferring full attempt data when available.
    const attempts = submissionDocs.map((sub) => {
      const full = sub.attemptId ? attemptsById.get(sub.attemptId) : null;
      if (full) {
        const ev = evalsByAttemptId.get(full.id);
        if (ev && full.status === "ai_failed" && ev.status === "ready_for_review") {
          return { ...full, status: "ready_for_review", evaluationRuns: [...(full.evaluationRuns || []), ...(ev.evaluationRuns || [])] };
        }
        return full;
      }
      const ev = evalsBySubmissionId.get(sub._docId);
      const submittedAt = sub.submittedAt?.toDate ? sub.submittedAt.toDate().toISOString() : (sub.submittedAt || new Date().toISOString());
      const status = sub.evaluationStatus === "ready_for_review" ? "ready_for_review"
        : (sub.evaluationStatus === "ai_processing" || sub.evaluationStatus === "pending_ai_processing") ? "ai_processing"
        : "ai_failed";
      return {
        id: sub.attemptId || sub._docId,
        participantId: participantId || "",
        learnerDisplayName: sub.displayName || "",
        caseId: sub.caseId, caseTitle: sub.caseTitle, category: "", caseVersion: "", rubricVersion: "",
        evaluationMode: "human_final", attemptNumber: sub.attemptNumber || 1,
        transcript: [], workProduct: sub.workProduct || "", sourceArtifacts: [],
        submissionMetadata: { messageCount: 0, learnerMessageCount: 0, agentMessageCount: 0, failedMessageCount: 0, workProductCharacterCount: (sub.workProduct || "").length, sourceArtifactCount: 0 },
        submittedAt, idempotencyKey: "", status, evaluationRuns: ev?.evaluationRuns || [],
      };
    });

    res.json({
      access: { participantId: participantId || "", displayName, email, privateToken: token },
      attempts,
      credentials: credentialsData,
    });
    return;
  }

  if (req.method === "POST" && path === "credentials/private/rotate") {
    await enforceRateLimit(`private-rotate:${req.ip}`, 5, 60 * 60 * 1000);
    const currentToken = req.body?.privateToken;
    if (
      !currentToken ||
      typeof currentToken !== "string" ||
      currentToken.length > 200
    ) {
      return sendError(res, 400, "Private access token is required.");
    }
    const grant = currentToken ? await resolvePrivateAccess(currentToken) : null;
    if (!grant) return sendError(res, 404, "Private access link not found.");
    const oldRef = db.collection("privateAccessGrants").doc(hash(currentToken));
    const participantRef = db.collection("participants").doc(grant.participantId);
    const nextToken = await db.runTransaction(async (transaction) => {
      const [oldGrantSnapshot, participantSnapshot] = await Promise.all([
        transaction.get(oldRef),
        transaction.get(participantRef),
      ]);
      if (!oldGrantSnapshot.exists || oldGrantSnapshot.data().revoked) {
        throw new Error("Private access link not found.");
      }
      const nextVersion =
        (participantSnapshot.data()?.privateTokenVersion || 1) + 1;
      const token = privateToken(grant.participantId, nextVersion);
      const nextRef = db.collection("privateAccessGrants").doc(hash(token));
      transaction.set(oldRef, { revoked: true, revokedAt: iso() }, { merge: true });
      transaction.create(nextRef, {
        participantId: grant.participantId,
        privateTokenVersion: nextVersion,
        revoked: false,
        createdAt: iso(),
        replacesGrantHash: hash(currentToken),
      });
      transaction.set(
        participantRef,
        { privateTokenVersion: nextVersion, updatedAt: iso() },
        { merge: true },
      );
      return token;
    });
    const participant = await participantRef.get();
    const data = participant.data();
    res.json({
      participantId: grant.participantId,
      displayName: data.displayName,
      email: data.email,
      privateToken: nextToken,
    });
    return;
  }

  if (parts[0] === "credentials" && parts[1] && parts[2] === "public") {
    const { privateToken: token } = req.body || {};
    if (!token || typeof token !== "string" || token.length > 200) {
      return sendError(res, 400, "Private access token is required.");
    }
    const credentialRef = db.collection("credentials").doc(parts[1]);
    const grantRef = db.collection("privateAccessGrants").doc(hash(token));
    if (req.method === "POST") {
      const next = await db.runTransaction(async (transaction) => {
        const [grantSnapshot, credentialSnapshot] = await Promise.all([
          transaction.get(grantRef),
          transaction.get(credentialRef),
        ]);
        const grant = grantSnapshot.data();
        const credential = credentialSnapshot.data();
        if (
          !grantSnapshot.exists ||
          grant.revoked ||
          !credentialSnapshot.exists ||
          credential.participantId !== grant.participantId
        ) {
          const error = new Error("Credential not found.");
          error.status = 404;
          throw error;
        }
        if (credential.status === "public" && credential.publicToken) {
          return credential;
        }
        const publicToken = id("verify");
        const updated = { ...credential, publicToken, status: "public" };
        transaction.set(credentialRef, updated);
        if (credential.publicToken) {
          transaction.set(
            db
              .collection("publicCredentialGrants")
              .doc(hash(credential.publicToken)),
            {
              credentialId: credential.id,
              revoked: true,
              revokedAt: iso(),
            },
            { merge: true },
          );
        }
        transaction.create(db.collection("publicCredentialGrants").doc(hash(publicToken)), {
          credentialId: credential.id,
          revoked: false,
          createdAt: iso(),
        });
        return updated;
      });
      res.json(next);
      return;
    }
    if (req.method === "DELETE") {
      const next = await db.runTransaction(async (transaction) => {
        const [grantSnapshot, credentialSnapshot] = await Promise.all([
          transaction.get(grantRef),
          transaction.get(credentialRef),
        ]);
        const grant = grantSnapshot.data();
        const credential = credentialSnapshot.data();
        if (
          !grantSnapshot.exists ||
          grant.revoked ||
          !credentialSnapshot.exists ||
          credential.participantId !== grant.participantId
        ) {
          const error = new Error("Credential not found.");
          error.status = 404;
          throw error;
        }
        const updated = { ...credential, status: "revoked" };
        transaction.set(credentialRef, updated);
        if (credential.publicToken) {
          transaction.set(db.collection("publicCredentialGrants").doc(hash(credential.publicToken)), { credentialId: credential.id, revoked: true }, { merge: true });
        }
        return updated;
      });
      res.json(next);
      return;
    }
  }

  if (req.method === "GET" && parts[0] === "credentials" && parts[1] === "public" && parts[2]) {
    await enforceRateLimit(`public-resolve:${req.ip}:${hash(parts[2])}`, 120, 15 * 60 * 1000);
    const grant = await db.collection("publicCredentialGrants").doc(hash(parts[2])).get();
    if (!grant.exists || grant.data().revoked) {
      res.json(null);
      return;
    }
    const credential = await db.collection("credentials").doc(grant.data().credentialId).get();
    res.json(
      credential.exists && credential.data().status === "public"
        ? publicCredentialView(credential.data())
        : null,
    );
    return;
  }

  sendError(res, 404, "Evaluation API route not found.");
}

exports.evaluationApi = onRequest(
  {
    secrets: [EVALUATOR_ACCESS_CODE, PRIVATE_TOKEN_SECRET, EVALUATION_API_KEY],
    cors: true,
    region: "us-central1",
    timeoutSeconds: 120,
  },
  async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      const status =
        error.status ||
        (error.message.includes("not found")
          ? 404
          : error.message.includes("claimed") ||
              error.message.includes("claim") ||
              error.message.includes("Finalized") ||
              error.message.includes("processing") ||
              error.message.includes("read-only")
            ? 409
            : 500);
      const log = status >= 500 ? logger.error : logger.warn;
      log("evaluationApi request rejected", {
        method: req.method,
        path: req.path,
        status,
        message: error.message,
      });
      sendError(res, status, error.message);
    }
  },
);

exports.processEvaluationJob = onDocumentCreated(
  {
    document: "evaluationJobs/{jobId}",
    secrets: [EVALUATION_API_KEY],
    region: "us-central1",
    retry: true,
    timeoutSeconds: 120,
  },
  async (event) => {
    const jobRef = event.data.ref;
    const job = await claimEvaluationJob(jobRef);
    if (!job) return;
    const attemptSnapshot = await db
      .collection("attempts")
      .doc(job.attemptId)
      .get();
    if (!attemptSnapshot.exists) {
      await jobRef.update({
        status: "failed",
        completedAt: iso(),
        leaseExpiresAt: null,
        error: "Attempt not found.",
      });
      return;
    }
    try {
      const run = await runAutomaticEvaluation(
        attemptSnapshot.data(),
        job.parentRunId || undefined,
      );
      await jobRef.update({
        status: run.status === "completed" ? "completed" : "failed",
        evaluationRunId: run.id,
        completedAt: iso(),
        leaseExpiresAt: null,
        error:
          run.status === "completed"
            ? null
            : (run.validationErrors || []).join("\n") || "Evaluation failed.",
      });
    } catch (error) {
      await jobRef.update({
        status: "queued",
        leaseExpiresAt: null,
        error: error.message,
      });
      throw error;
    }
  },
);

exports._test = {
  scoreReview,
  validateDraft,
  validateEvaluationResult,
  publicCredentialView,
  statusAfterClaimRelease,
  submissionMetadata,
  sourceLocatorResolves,
  filterAttemptsForQuery,
  validateSubmissionInput,
  hash,
};
