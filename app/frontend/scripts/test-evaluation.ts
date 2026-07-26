import assert from "node:assert/strict";

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
  clear() { this.values.clear(); }
}

Object.assign(globalThis, {
  window: {
    localStorage: new MemoryStorage(),
    sessionStorage: new MemoryStorage(),
  },
});

const { CASE_DEFINITIONS, getCaseDefinition, validateRubric } = await import(
  "../src/evaluation/rubrics.ts"
);
const { median, scoreReview, validateReview } = await import(
  "../src/evaluation/domain.ts"
);
const { evaluationRepository } = await import(
  "../src/evaluation/repository.ts"
);
const {
  filterQueueAttempts,
  readQueueFilters,
  writeQueueFilters,
} = await import("../src/evaluation/queueFilters.ts");
const { resolveSourceArtifact } = await import(
  "../src/evaluation/sourceArtifactResolver.ts"
);
const { getEvaluatorSession, setEvaluatorSession } = await import(
  "../src/evaluation/session.ts"
);

setEvaluatorSession({
  token: "valid-session",
  evaluatorName: "Evaluator One",
  expiresAt: "2099-01-01T00:00:00.000Z",
});
assert.equal(getEvaluatorSession()?.token, "valid-session");
window.sessionStorage.setItem("simworks:evaluator-session", "{malformed");
assert.equal(getEvaluatorSession(), null, "malformed evaluator sessions are discarded");

for (const definition of CASE_DEFINITIONS) {
  assert.deepEqual(validateRubric(definition), [], `${definition.id} rubric`);
}

const legal = getCaseDefinition("first-year-associate-ma-due-diligence");
const maximumScores = legal.rubric.criteria.map((criterion) => ({
  criterionId: criterion.id,
  points: criterion.maxPoints,
  note: "",
  overrideReason: "Human verified the complete immutable evidence.",
}));
assert.equal(scoreReview(legal.id, maximumScores).outcome, "pass");
assert.equal(median([]), 0);
assert.equal(median([4, 1, 3]), 3);
assert.equal(median([10, 2, 8, 4]), 6);

const caseOnlyScores = legal.rubric.criteria.map((criterion) => ({
  criterionId: criterion.id,
  points: criterion.dimension === "case_outcome" ? criterion.maxPoints : 0,
  note: "",
  overrideReason: "Human verified the complete immutable evidence.",
}));
assert.equal(
  scoreReview(legal.id, caseOnlyScores).outcome,
  "remediation_required",
  "both proficiency dimensions must pass",
);

const participantId = "participant-test";
const transcript = [
  {
    id: "message-1",
    role: "learner" as const,
    content: "Original immutable content",
    status: "sent" as const,
    createdAt: "2026-07-26T00:00:00.000Z",
  },
];
const submission = {
  displayName: "Test Learner",
  email: "learner@example.com",
  participantId,
  caseId: legal.id,
  transcript,
  workProduct: "Original immutable work product",
  idempotencyKey: "one-browser-action",
};
const first = await evaluationRepository.submitAttempt(submission);
transcript[0].content = "Mutated after submission";
const second = await evaluationRepository.submitAttempt(submission);
assert.equal(first.attempt.id, second.attempt.id, "submission must be idempotent");
assert.equal(first.notification.id, second.notification.id, "receipt must be idempotent");
assert.equal(first.attempt.status, "ai_failed");
assert.equal(first.attempt.evaluationRuns[0].status, "failed");
assert.equal(first.attempt.caseVersion, legal.version);
assert.equal(first.attempt.rubricVersion, legal.rubric.rubricVersion);
assert.deepEqual(first.attempt.submissionMetadata, {
  messageCount: 1,
  learnerMessageCount: 1,
  agentMessageCount: 0,
  failedMessageCount: 0,
  workProductCharacterCount: "Original immutable work product".length,
  sourceArtifactCount: 1,
  firstInteractionAt: "2026-07-26T00:00:00.000Z",
  lastInteractionAt: "2026-07-26T00:00:00.000Z",
});
assert.deepEqual(
  first.attempt.sourceArtifacts.map((artifact) => artifact.id),
  ["agreement-packet.md"],
);
assert.equal(
  resolveSourceArtifact(
    [{ id: "agreement-packet.md" }],
    legal.id,
    "first-year-associate-ma-due-diligence-packet",
  )?.id,
  "agreement-packet.md",
  "historical case-level packet IDs remain reviewable",
);
assert.equal(
  (await evaluationRepository.getAttempt(first.attempt.id))?.transcript[0].content,
  "Original immutable content",
  "submitted transcript must be snapshotted",
);
writeQueueFilters({
  caseId: legal.id,
  status: "all",
  recommendation: "all",
  attemptNumber: "all",
  submittedWithinDays: "all",
});
assert.equal(readQueueFilters().caseId, legal.id);
const ordered = filterQueueAttempts(
  [
    {
      ...first.attempt,
      id: "final-old",
      status: "pass",
      submittedAt: "2026-07-25T00:00:00.000Z",
    },
    {
      ...first.attempt,
      id: "ready-new",
      status: "ready_for_review",
      submittedAt: "2026-07-26T00:00:00.000Z",
    },
  ],
  readQueueFilters(),
);
assert.equal(ordered[0].id, "ready-new", "oldest ready work is prioritized");
const retriedEvaluation = await evaluationRepository.retryEvaluation(first.attempt.id);
assert.equal(retriedEvaluation.status, "ai_failed");
assert.equal(retriedEvaluation.evaluationRuns.length, 2);
assert.equal(
  retriedEvaluation.evaluationRuns[1].parentRunId,
  retriedEvaluation.evaluationRuns[0].id,
);

await evaluationRepository.claimReview(first.attempt.id, "Evaluator One");
await assert.rejects(
  evaluationRepository.claimReview(first.attempt.id, "Evaluator Two"),
  /currently claimed/,
);
const claimed = await evaluationRepository.claimReview(
  first.attempt.id,
  "Evaluator Two",
  true,
);
assert.equal(claimed.claim?.takeoverHistory.length, 1);
const released = await evaluationRepository.releaseClaim(
  first.attempt.id,
  "Evaluator Two",
);
assert.equal(
  released.status,
  "ai_failed",
  "releasing a failed run must not relabel it as AI-ready",
);
const reclaimed = await evaluationRepository.claimReview(
  first.attempt.id,
  "Evaluator Two",
);

const draft = {
  scores: maximumScores,
  summary: "The learner met both proficiency thresholds.",
  outcome: "pass" as const,
  outcomeOverrideReason: "",
};
assert.deepEqual(validateReview(reclaimed, draft), []);
const finalized = await evaluationRepository.finalizeReview(
  first.attempt.id,
  "Evaluator Two",
  draft,
);
const retriedFinalization = await evaluationRepository.finalizeReview(
  first.attempt.id,
  "Evaluator Two",
  draft,
);
assert.equal(finalized.attempt.review?.status, "final");
assert.equal(finalized.credential?.id, retriedFinalization.credential?.id);
assert.equal(finalized.notification.id, retriedFinalization.notification.id);

let remediationPredecessorId = "";
const nonPassCases = [
  {
    outcome: "remediation_required" as const,
    scores: caseOnlyScores,
    idempotencyKey: "non-pass-remediation",
  },
  {
    outcome: "not_yet_ready" as const,
    scores: legal.rubric.criteria.map((criterion) => ({
      criterionId: criterion.id,
      points: 0,
      note: "",
      overrideReason: "",
    })),
    idempotencyKey: "non-pass-not-ready",
  },
];
for (const nonPass of nonPassCases) {
  const nonPassSubmission = await evaluationRepository.submitAttempt({
    ...submission,
    transcript: [
      {
        id: `message-${nonPass.idempotencyKey}`,
        role: "learner",
        content: "A separate immutable non-pass attempt.",
        status: "sent",
        createdAt: "2026-07-26T00:30:00.000Z",
      },
    ],
    idempotencyKey: nonPass.idempotencyKey,
  });
  await evaluationRepository.claimReview(
    nonPassSubmission.attempt.id,
    "Evaluator Two",
  );
  const nonPassFinal = await evaluationRepository.finalizeReview(
    nonPassSubmission.attempt.id,
    "Evaluator Two",
    {
      scores: nonPass.scores,
      summary: `Final ${nonPass.outcome} result.`,
      outcome: nonPass.outcome,
      outcomeOverrideReason: "",
    },
  );
  assert.equal(nonPassFinal.credential, undefined);
  assert.equal(nonPassFinal.notification.kind, "result");
  if (nonPass.outcome === "remediation_required") {
    remediationPredecessorId = nonPassFinal.attempt.id;
  }
}

const remediationAttempt = await evaluationRepository.submitAttempt({
  ...submission,
  transcript: [
    {
      id: "message-retry-1",
      role: "learner",
      content: "Fresh remediation transcript",
      status: "sent",
      createdAt: "2026-07-26T01:00:00.000Z",
    },
  ],
  workProduct: "Fresh remediation work product",
  idempotencyKey: "linked-remediation",
  predecessorAttemptId: remediationPredecessorId,
});
assert.equal(remediationAttempt.attempt.attemptNumber, 4);
assert.equal(
  remediationAttempt.attempt.predecessorAttemptId,
  remediationPredecessorId,
);
assert.equal(
  remediationAttempt.attempt.transcript[0].content,
  "Fresh remediation transcript",
);

const publicCredential = await evaluationRepository.createPublicLink(
  finalized.credential!.id,
  first.access.privateToken,
);
assert.equal(publicCredential.status, "public");
assert.ok(publicCredential.publicToken);
const repeatedPublicCredential = await evaluationRepository.createPublicLink(
  finalized.credential!.id,
  first.access.privateToken,
);
assert.equal(
  repeatedPublicCredential.publicToken,
  publicCredential.publicToken,
  "public-link creation must be idempotent while the link is active",
);
const revoked = await evaluationRepository.revokePublicLink(
  finalized.credential!.id,
  first.access.privateToken,
);
assert.equal(revoked.status, "revoked");
assert.equal(
  await evaluationRepository.resolvePublicCredential(
    publicCredential.publicToken!,
  ),
  null,
);
const replacementPublicCredential =
  await evaluationRepository.createPublicLink(
    finalized.credential!.id,
    first.access.privateToken,
  );
assert.notEqual(
  replacementPublicCredential.publicToken,
  publicCredential.publicToken,
);
assert.equal(
  await evaluationRepository.resolvePublicCredential(
    publicCredential.publicToken!,
  ),
  null,
);

const rotatedAccess = await evaluationRepository.rotatePrivateAccess(
  first.access.privateToken,
);
assert.notEqual(rotatedAccess.privateToken, first.access.privateToken);
assert.equal(
  await evaluationRepository.getLearnerCollection(first.access.privateToken),
  null,
);
assert.ok(
  await evaluationRepository.getLearnerCollection(rotatedAccess.privateToken),
);

console.log("evaluation domain: all checks passed");
