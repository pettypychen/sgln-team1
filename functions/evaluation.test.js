"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { _test } = require("./evaluation");
const { _test: publicCredentialTest } = require("./publicCredential");
const { _test: notificationTest } = require("./notifications");
const deployedFunctions = require("./index");
const casePackages = require("./generated/cases.json");
const { derivePrivateToken } = require("./token");

const definition = {
  caseThreshold: 10,
  interactionThreshold: 5,
  criteria: [
    ["case-a", "case_outcome", 10],
    ["interaction-a", "ai_interaction", 5, true],
  ],
};

test("dual thresholds and critical failures drive shared outcomes", () => {
  assert.equal(
    _test.scoreReview(definition, [
      { criterionId: "case-a", points: 10 },
      { criterionId: "interaction-a", points: 5 },
    ]).outcome,
    "pass",
  );
  assert.equal(
    _test.scoreReview(definition, [
      { criterionId: "case-a", points: 10 },
      { criterionId: "interaction-a", points: 0 },
    ]).outcome,
    "remediation_required",
  );
});

test("attempt queries filter shared data by case, status, recommendation, and date", () => {
  const attempts = [
    {
      id: "matching",
      caseId: "kopi-run",
      status: "ready_for_review",
      submittedAt: "2026-07-26T01:00:00.000Z",
      evaluationRuns: [{ status: "completed", recommendation: "pass" }],
    },
    {
      id: "wrong-status",
      caseId: "kopi-run",
      status: "ai_failed",
      submittedAt: "2026-07-26T02:00:00.000Z",
      evaluationRuns: [{ status: "failed" }],
    },
  ];
  assert.deepEqual(
    _test
      .filterAttemptsForQuery(attempts, {
        caseId: "kopi-run",
        status: "ready_for_review",
        recommendation: "pass",
        submittedAfter: "2026-07-26T00:00:00.000Z",
        submittedBefore: "2026-07-27T00:00:00.000Z",
      })
      .map(({ id }) => id),
    ["matching"],
  );
  assert.throws(
    () => _test.filterAttemptsForQuery(attempts, { status: "unknown" }),
    /Unknown attempt status/,
  );
  assert.throws(
    () =>
      _test.filterAttemptsForQuery(attempts, {
        submittedAfter: "2026-07-27T00:00:00.000Z",
        submittedBefore: "2026-07-26T00:00:00.000Z",
      }),
    /Invalid submission date range/,
  );
});

test("evidence validation rejects unresolved awarded points", () => {
  const attempt = {
    caseId: "first-year-associate-ma-due-diligence",
    transcript: [{ id: "message-1" }],
    sourceArtifacts: [{ id: "artifact-1" }],
  };
  const result = {
    assessments: [
      {
        criterionId: "legal-transaction-map",
        points: 2,
        supported: true,
        evidence: [
          {
            messageId: "missing-message",
            source: { artifactId: "artifact-1" },
          },
        ],
      },
    ],
  };
  const errors = _test.validateEvaluationResult(attempt, result);
  assert.equal(result.assessments[0].supported, false);
  assert.ok(errors.some((error) => error.includes("resolvable evidence")));
});

function legalAttempt() {
  const sourceArtifact = casePackages[
    "first-year-associate-ma-due-diligence"
  ].artifacts[0];
  return {
    caseId: "first-year-associate-ma-due-diligence",
    transcript: [
      {
        id: "message-1",
        content: "The learner separated verified facts from assumptions.",
      },
    ],
    sourceArtifacts: [{ id: sourceArtifact.id }],
  };
}

function legalAssessments(scale) {
  return casePackages[
    "first-year-associate-ma-due-diligence"
  ].rubric.criteria.map((criterion) => ({
    criterionId: criterion.id,
    points: Math.round(criterion.maxPoints * scale),
    explanation: `Structured assessment for ${criterion.label}.`,
    supported: true,
    evidence: [
      {
        messageId: "message-1",
        source: {
          artifactId: casePackages[
            "first-year-associate-ma-due-diligence"
          ].artifacts[0].id,
          locator: "row 1",
        },
        excerpt: "The learner separated verified facts from assumptions.",
        connection: `This supports ${criterion.label}.`,
      },
    ],
  }));
}

test("representative strong, borderline, and weak structured outputs validate", () => {
  for (const scale of [0.9, 0.65, 0.25]) {
    const result = { assessments: legalAssessments(scale) };
    assert.deepEqual(
      _test.validateEvaluationResult(legalAttempt(), result),
      [],
      `scale ${scale}`,
    );
  }
});

test("every released case validates representative outputs and all artifact types", () => {
  for (const casePackage of Object.values(casePackages).filter(
    (item) => item.released,
  )) {
    const attempt = {
      caseId: casePackage.id,
      transcript: [
        {
          id: `${casePackage.id}-message`,
          content: "The learner used and checked this supplied source.",
        },
      ],
      sourceArtifacts: casePackage.artifacts.map(({ id }) => ({ id })),
    };
    for (const scale of [0.9, 0.65, 0.25]) {
      const assessments = casePackage.rubric.criteria.map(
        (criterion, index) => ({
          criterionId: criterion.id,
          points: Math.round(criterion.maxPoints * scale),
          explanation: `Representative ${scale} assessment for ${criterion.label}.`,
          supported: true,
          evidence: [
            {
              messageId: `${casePackage.id}-message`,
              source: {
                artifactId:
                  casePackage.artifacts[index % casePackage.artifacts.length]
                    .id,
                locator: `item ${index + 1}`,
              },
              excerpt: "The learner used and checked this supplied source.",
              connection: `This evidence supports ${criterion.label}.`,
            },
          ],
        }),
      );
      assert.deepEqual(
        _test.validateEvaluationResult(attempt, { assessments }),
        [],
        `${casePackage.id} at scale ${scale}`,
      );
      assert.deepEqual(
        new Set(
          assessments.flatMap((assessment) =>
            assessment.evidence.map(
              (evidence) => evidence.source.artifactId,
            ),
          ),
        ),
        new Set(casePackage.artifacts.map(({ id }) => id)),
        `${casePackage.id} should exercise every artifact type`,
      );
    }
  }
});

test("malformed, duplicate, out-of-range, and incomplete AI output is invalid", () => {
  assert.match(
    _test.validateEvaluationResult(legalAttempt(), null)[0],
    /structured object/,
  );
  assert.match(
    _test.validateEvaluationResult(legalAttempt(), { assessments: {} })[0],
    /must be an array/,
  );

  const result = { assessments: legalAssessments(0.9) };
  result.assessments.push({ ...result.assessments[0] });
  result.assessments[1].points = 999;
  result.assessments[2].evidence = [
    { messageId: "message-1", excerpt: "", connection: "" },
  ];
  const errors = _test.validateEvaluationResult(legalAttempt(), result);
  assert.ok(errors.some((error) => error.includes("Duplicate criterion")));
  assert.ok(errors.some((error) => error.includes("points must be between")));
  assert.ok(
    errors.some((error) => error.includes("lack resolvable evidence")),
  );
  assert.equal(result.assessments[1].supported, false);
  assert.equal(result.assessments[2].supported, false);
});

test("human review validation enforces exact rubric scores and override reasons", () => {
  const assessments = legalAssessments(0.9);
  const attempt = {
    caseId: "first-year-associate-ma-due-diligence",
    evaluationRuns: [{ status: "completed", assessments }],
  };
  const scores = assessments.map((assessment) => ({
    criterionId: assessment.criterionId,
    points: assessment.points,
    note: "",
    overrideReason: "",
  }));
  const draft = {
    scores,
    summary: "The learner met both proficiency thresholds.",
    outcome: "pass",
    outcomeOverrideReason: "",
  };
  assert.deepEqual(_test.validateDraft(attempt, draft), []);

  const changed = structuredClone(draft);
  changed.scores[0].points -= 1;
  assert.ok(
    _test
      .validateDraft(attempt, changed)
      .some((error) => error.includes("override reason required")),
  );

  const duplicate = structuredClone(draft);
  duplicate.scores.push({ ...duplicate.scores[0] });
  assert.ok(
    _test
      .validateDraft(attempt, duplicate)
      .some((error) => error.includes("Duplicate human score")),
  );

  assert.match(
    _test.validateDraft(attempt, null)[0],
    /Review draft is required/,
  );
});

test("manual review remains valid when every AI run failed", () => {
  const assessments = legalAssessments(0.9);
  const attempt = {
    caseId: "first-year-associate-ma-due-diligence",
    evaluationRuns: [{ status: "failed", assessments: [] }],
  };
  const draft = {
    scores: assessments.map((assessment) => ({
      criterionId: assessment.criterionId,
      points: assessment.points,
      note: "Scored directly from immutable evidence.",
      overrideReason: "",
    })),
    summary: "Manual review completed after provider failure.",
    outcome: "pass",
    outcomeOverrideReason: "",
  };
  assert.deepEqual(_test.validateDraft(attempt, draft), []);
});

test("hashes are deterministic and do not expose tokens", () => {
  const first = _test.hash("private-secret-token");
  assert.equal(first, _test.hash("private-secret-token"));
  assert.notEqual(first, "private-secret-token");
});

test("private token rotation is deterministic by version and never reuses an old link", () => {
  const first = derivePrivateToken("participant-1", 1, "test-secret");
  const second = derivePrivateToken("participant-1", 2, "test-secret");
  assert.equal(
    first,
    derivePrivateToken("participant-1", 1, "test-secret"),
  );
  assert.notEqual(first, second);
  assert.match(first, /^private_[a-f0-9]{64}$/);
});

test("claim release restores the underlying evaluation state", () => {
  assert.equal(
    _test.statusAfterClaimRelease({
      evaluationRuns: [{ status: "completed" }],
    }),
    "ready_for_review",
  );
  assert.equal(
    _test.statusAfterClaimRelease({
      evaluationRuns: [{ status: "failed" }],
    }),
    "ai_failed",
  );
  assert.equal(
    _test.statusAfterClaimRelease({
      evaluationRuns: [{ status: "processing" }],
    }),
    "ai_processing",
  );
});

test("submission validation accepts bounded snapshots and rejects malformed data", () => {
  const valid = {
    displayName: "Test Learner",
    email: "learner@example.test",
    participantId: "participant-1",
    idempotencyKey: "submission-1",
    transcript: [
      {
        id: "message-1",
        role: "learner",
        content: "Source-grounded response.",
        status: "sent",
        createdAt: "2026-07-26T00:00:00.000Z",
      },
    ],
    workProduct: "Final work product",
  };
  assert.deepEqual(_test.validateSubmissionInput(valid), []);
  const malformed = {
    ...valid,
    email: "not-an-email",
    transcript: [valid.transcript[0], valid.transcript[0]],
    workProduct: { unsafe: true },
  };
  const errors = _test.validateSubmissionInput(malformed);
  assert.ok(errors.some((error) => error.includes("valid email")));
  assert.ok(errors.some((error) => error.includes("duplicate message")));
  assert.ok(errors.some((error) => error.includes("Work product")));
});

test("submission metadata captures immutable coverage and interaction facts", () => {
  assert.deepEqual(
    _test.submissionMetadata(
      [
        {
          role: "learner",
          status: "sent",
          createdAt: "2026-07-26T00:00:02.000Z",
        },
        {
          role: "agent",
          status: "failed",
          createdAt: "2026-07-26T00:00:01.000Z",
        },
      ],
      "final",
      [{ id: "source-1" }, { id: "source-2" }],
    ),
    {
      messageCount: 2,
      learnerMessageCount: 1,
      agentMessageCount: 1,
      failedMessageCount: 1,
      workProductCharacterCount: 5,
      sourceArtifactCount: 2,
      firstInteractionAt: "2026-07-26T00:00:01.000Z",
      lastInteractionAt: "2026-07-26T00:00:02.000Z",
    },
  );
});

test("public credential API uses the documented privacy allowlist", () => {
  const view = _test.publicCredentialView({
    id: "cred-1",
    participantId: "private-participant",
    attemptId: "private-attempt",
    learnerDisplayName: "Test Learner",
    caseId: "kopi-run",
    caseTitle: "Kopi Run",
    category: "Onboarding",
    awardDate: "2026-07-26T00:00:00.000Z",
    issuer: "SimWorks",
    evaluationAuthority: "Human verified with AI-assisted scoring",
    status: "public",
    publicToken: "private-token",
    email: "private@example.test",
    scores: [99],
    evaluatorName: "Private Evaluator",
  });
  assert.deepEqual(Object.keys(view).sort(), [
    "awardDate",
    "caseId",
    "caseTitle",
    "category",
    "evaluationAuthority",
    "id",
    "issuer",
    "learnerDisplayName",
    "status",
  ]);
  assert.doesNotMatch(JSON.stringify(view), /private-|99/);
});

test("public credential HTML exposes only the verification allowlist", () => {
  const html = publicCredentialTest.page({
    valid: true,
    appUrl: "https://example.test",
    credential: {
      id: "cred-1",
      caseId: "kopi-run",
      learnerDisplayName: "Test Learner",
      caseTitle: "Kopi Run",
      category: "Onboarding",
      awardDate: "2026-07-26T00:00:00.000Z",
      status: "public",
      evaluatorName: "Secret Evaluator",
      email: "private@example.test",
      scores: [99],
    },
  });
  assert.match(html, /Test Learner/);
  assert.match(html, /Credential ID/);
  assert.doesNotMatch(html, /Secret Evaluator/);
  assert.doesNotMatch(html, /private@example\.test/);
  assert.doesNotMatch(html, /99/);
  assert.match(html, /og:image/);
  assert.match(html, /credential-social-card\.png/);
});

test("notification outcomes use the shared labels", () => {
  assert.equal(notificationTest.outcomeLabel("pass"), "Pass");
  assert.equal(
    notificationTest.outcomeLabel("remediation_required"),
    "Remediation required",
  );
  assert.equal(notificationTest.outcomeLabel("not_yet_ready"), "Not yet ready");
});

function resultAttempt(outcome) {
  return {
    id: "attempt-1",
    participantId: "participant-1",
    learnerDisplayName: "<Test Learner>",
    caseTitle: "Kopi Run",
    attemptNumber: 1,
    submittedAt: "2026-07-26T00:00:00.000Z",
    transcript: ["PRIVATE TRANSCRIPT"],
    scores: [99],
    review: {
      status: "final",
      outcome,
      summary: "Clear work with focused next steps.",
      evaluatorName: "PRIVATE EVALUATOR",
    },
  };
}

test("receipt and all result emails are privacy-safe and outcome-specific", () => {
  const participant = { email: "learner@example.test" };
  const token = "private_test_token";
  const receipt = notificationTest.buildEmail(
    { kind: "submission_receipt" },
    resultAttempt("pass"),
    participant,
    token,
  );
  assert.match(receipt.subject, /Submission received/);
  assert.match(receipt.text, /\/credentials#private_test_token/);
  assert.doesNotMatch(receipt.text, /\/credentials\/private_test_token/);
  assert.match(receipt.html, /&lt;Test Learner&gt;/);

  for (const outcome of [
    "pass",
    "remediation_required",
    "not_yet_ready",
  ]) {
    const email = notificationTest.buildEmail(
      { kind: "result" },
      resultAttempt(outcome),
      participant,
      token,
    );
    assert.match(email.subject, new RegExp(notificationTest.outcomeLabel(outcome), "i"));
    for (const privateValue of [
      "PRIVATE TRANSCRIPT",
      "PRIVATE EVALUATOR",
      "99",
    ]) {
      assert.doesNotMatch(email.text, new RegExp(privateValue));
      assert.doesNotMatch(email.html, new RegExp(privateValue));
    }
    if (outcome === "pass") {
      assert.match(email.html, /credential-social-card\.png/);
    } else {
      assert.doesNotMatch(email.html, /credential-social-card\.png/);
    }
  }
});

test("background evaluation and notification retry functions are deployed", () => {
  assert.equal(typeof deployedFunctions.processEvaluationJob, "function");
  assert.equal(
    typeof deployedFunctions.retryEvaluationNotifications,
    "function",
  );
  assert.equal(typeof deployedFunctions.onSubmissionCreated, "function");
});
