"use strict";

const assert = require("node:assert/strict");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const BASE =
  "http://127.0.0.1:5101/demo-sgln-evaluation/us-central1/evaluationApi/api/evaluation";
const MOCK = "http://127.0.0.1:9876";
const PROJECT_ID = "demo-sgln-evaluation";
const FIRESTORE_REST =
  `http://127.0.0.1:8180/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const db = getFirestore(initializeApp({ projectId: PROJECT_ID }));

async function request(path, { method = "GET", token, body, expected = 200 } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json();
  assert.equal(
    response.status,
    expected,
    `${method} ${path}: expected ${expected}, received ${response.status}: ${JSON.stringify(payload)}`,
  );
  return payload;
}

async function eventually(label, read, predicate, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let latest;
  while (Date.now() < deadline) {
    latest = await read();
    if (predicate(latest)) return latest;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.fail(`${label} did not become true. Latest value: ${JSON.stringify(latest)}`);
}

function submission(participantId, idempotencyKey) {
  const displayName = participantId
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  return {
    participantId,
    displayName,
    email: `${participantId}@example.test`,
    caseId: "kopi-run",
    idempotencyKey,
    transcript: [
      {
        id: `${participantId}-message-1`,
        role: "learner",
        content: "I checked the menu, clarified ambiguity, and verified the corrected order.",
        status: "sent",
        createdAt: new Date().toISOString(),
      },
    ],
    workProduct: "A complete, source-referenced order and verification summary.",
  };
}

function passingDraft(attempt) {
  const completed = attempt.evaluationRuns.find((run) => run.status === "completed");
  assert.ok(completed, "A completed automatic evaluation is required.");
  return {
    scores: completed.assessments.map((assessment) => ({
      criterionId: assessment.criterionId,
      points: assessment.points,
      note: "Confirmed against the cited source.",
    })),
    outcome: "pass",
    summary: "Human review confirms both thresholds and all critical criteria.",
    supplementalLabel: "Distinction",
  };
}

async function verifyFirestoreRules() {
  await Promise.all([
    db.collection("simulations").doc("rules-public-case").set({
      title: "Rules test case",
      released: true,
    }),
    db.collection("simulations").doc("rules-unreleased-case").set({
      title: "Unreleased rules test case",
      released: false,
    }),
    db.collection("privateTestRecords").doc("rules-private-record").set({
      secret: "must stay server-only",
    }),
  ]);

  const publicRead = await fetch(
    `${FIRESTORE_REST}/simulations/rules-public-case`,
  );
  assert.equal(publicRead.status, 200, "released simulation content is public");

  const unreleasedRead = await fetch(
    `${FIRESTORE_REST}/simulations/rules-unreleased-case`,
  );
  assert.equal(
    unreleasedRead.status,
    403,
    "unreleased simulation content must not be public",
  );

  const privateRead = await fetch(
    `${FIRESTORE_REST}/privateTestRecords/rules-private-record`,
  );
  assert.equal(
    privateRead.status,
    403,
    "private operational records must reject direct client reads",
  );

  const publicWrite = await fetch(
    `${FIRESTORE_REST}/simulations/rules-public-case`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fields: {
          title: { stringValue: "Client overwrite" },
        },
      }),
    },
  );
  assert.equal(
    publicWrite.status,
    403,
    "simulation content must reject direct client writes",
  );

  const privateWrite = await fetch(
    `${FIRESTORE_REST}/privateTestRecords?documentId=client-created`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fields: {
          secret: { stringValue: "client write" },
        },
      }),
    },
  );
  assert.equal(
    privateWrite.status,
    403,
    "operational collections must reject direct client writes",
  );
}

async function main() {
  await verifyFirestoreRules();

  const [first, second] = await Promise.all([
    request("/attempts", {
      method: "POST",
      body: submission("learner-a", "shared-device-a-1"),
    }),
    request("/attempts", {
      method: "POST",
      body: submission("learner-b", "shared-device-b-1"),
    }),
  ]);
  assert.notEqual(first.attempt.id, second.attempt.id);
  assert.equal(first.attempt.attemptNumber, 1);
  assert.equal(second.attempt.attemptNumber, 1);

  const duplicate = await request("/attempts", {
    method: "POST",
    body: submission("learner-a", "shared-device-a-1"),
  });
  assert.equal(duplicate.attempt.id, first.attempt.id);

  const evaluatorA = await request("/evaluator/session", {
    method: "POST",
    body: { code: "local-evaluator-code", evaluatorName: "Evaluator A" },
  });
  const evaluatorB = await request("/evaluator/session", {
    method: "POST",
    body: { code: "local-evaluator-code", evaluatorName: "Evaluator B" },
  });

  const retrySubmission = await request("/attempts", {
    method: "POST",
    body: submission(
      "learner-evaluation-retry",
      "evaluation-retry-attempt-1",
    ),
  });
  const failedEvaluation = await eventually(
    "failed automatic evaluation",
    () =>
      request(`/attempts/${retrySubmission.attempt.id}`, {
        token: evaluatorA.token,
      }),
    (attempt) => attempt?.status === "ai_failed",
  );
  assert.equal(failedEvaluation.evaluationRuns.length, 1);
  assert.equal(failedEvaluation.evaluationRuns[0].status, "failed");
  await request(
    `/attempts/${retrySubmission.attempt.id}/evaluation-runs`,
    {
      method: "POST",
      token: evaluatorA.token,
      expected: 202,
    },
  );
  const recoveredEvaluation = await eventually(
    "retried automatic evaluation",
    () =>
      request(`/attempts/${retrySubmission.attempt.id}`, {
        token: evaluatorA.token,
      }),
    (attempt) =>
      attempt?.status === "ready_for_review" &&
      attempt.evaluationRuns.length === 2,
  );
  assert.deepEqual(
    recoveredEvaluation.evaluationRuns.map(({ status }) => status),
    ["failed", "completed"],
  );
  assert.equal(
    recoveredEvaluation.evaluationRuns[1].parentRunId,
    recoveredEvaluation.evaluationRuns[0].id,
  );

  const ready = await eventually(
    "background evaluation",
    () => request(`/attempts/${first.attempt.id}`, { token: evaluatorA.token }),
    (attempt) => attempt?.status === "ready_for_review",
  );
  assert.equal(ready.evaluationRuns.length, 1);
  assert.equal(ready.evaluationRuns[0].validationStatus, "valid");
  const filteredQueue = await request(
    "/attempts?caseId=kopi-run&status=ready_for_review&recommendation=pass&submittedAfter=2020-01-01T00%3A00%3A00.000Z",
    { token: evaluatorA.token },
  );
  assert.ok(filteredQueue.some((attempt) => attempt.id === ready.id));
  assert.ok(
    filteredQueue.every(
      (attempt) =>
        attempt.caseId === "kopi-run" &&
        attempt.status === "ready_for_review" &&
        attempt.evaluationRuns.some(
          (run) =>
            run.status === "completed" && run.recommendation === "pass",
        ),
    ),
  );

  await request(`/attempts/${ready.id}/claim`, {
    method: "POST",
    token: evaluatorA.token,
    body: { evaluatorName: "Evaluator A" },
  });
  await request(`/attempts/${ready.id}/claim`, {
    method: "POST",
    token: evaluatorB.token,
    body: { evaluatorName: "Evaluator B" },
    expected: 409,
  });
  const takenOver = await request(`/attempts/${ready.id}/claim`, {
    method: "POST",
    token: evaluatorB.token,
    body: { evaluatorName: "Evaluator B", takeover: true },
  });
  assert.deepEqual(takenOver.claim.takeoverHistory.map(({ from, to }) => ({ from, to })), [
    { from: "Evaluator A", to: "Evaluator B" },
  ]);

  const draft = passingDraft(ready);
  await request(`/attempts/${ready.id}/review`, {
    method: "PUT",
    token: evaluatorA.token,
    body: { evaluatorName: "Evaluator A", draft },
    expected: 409,
  });
  const finalized = await request(`/attempts/${ready.id}/finalize`, {
    method: "POST",
    token: evaluatorB.token,
    body: { evaluatorName: "Evaluator B", draft },
  });
  assert.equal(finalized.attempt.review.status, "final");
  assert.equal(finalized.attempt.review.outcome, "pass");
  assert.ok(finalized.credential?.id);

  const finalizedAgain = await request(`/attempts/${ready.id}/finalize`, {
    method: "POST",
    token: evaluatorB.token,
    body: { evaluatorName: "Evaluator B", draft },
  });
  assert.equal(finalizedAgain.credential.id, finalized.credential.id);
  assert.equal(finalizedAgain.notification.id, finalized.notification.id);

  const privateCollection = await request("/credentials/private/resolve", {
    method: "POST",
    body: { privateToken: first.access.privateToken },
  });
  assert.equal(privateCollection.attempts.length, 1);
  assert.equal(privateCollection.credentials.length, 1);

  const [publicCredential, concurrentPublicCredential] = await Promise.all([
    request(`/credentials/${finalized.credential.id}/public`, {
      method: "POST",
      body: { privateToken: first.access.privateToken },
    }),
    request(`/credentials/${finalized.credential.id}/public`, {
      method: "POST",
      body: { privateToken: first.access.privateToken },
    }),
  ]);
  assert.equal(
    concurrentPublicCredential.publicToken,
    publicCredential.publicToken,
    "concurrent public-link creation must be idempotent",
  );
  const publicView = await request(`/credentials/public/${publicCredential.publicToken}`);
  assert.deepEqual(Object.keys(publicView).sort(), [
    "awardDate",
    "caseId",
    "caseTitle",
    "category",
    "evaluationAuthority",
    "id",
    "issuer",
    "learnerDisplayName",
    "status",
    "supplementalLabel",
  ]);
  assert.equal(publicView.learnerDisplayName, "Learner A");

  await request(`/credentials/${finalized.credential.id}/public`, {
    method: "DELETE",
    body: { privateToken: first.access.privateToken },
  });
  assert.equal(
    await request(`/credentials/public/${publicCredential.publicToken}`),
    null,
  );

  const rotated = await request("/credentials/private/rotate", {
    method: "POST",
    body: { privateToken: first.access.privateToken },
  });
  assert.equal(
    await request("/credentials/private/resolve", {
      method: "POST",
      body: { privateToken: first.access.privateToken },
    }),
    null,
  );
  assert.ok(
    await request("/credentials/private/resolve", {
      method: "POST",
      body: { privateToken: rotated.privateToken },
    }),
  );

  const later = await request("/attempts", {
    method: "POST",
    body: submission("learner-a", "shared-device-a-2"),
  });
  assert.equal(later.attempt.attemptNumber, 2);
  assert.equal(later.access.privateToken, rotated.privateToken);

  const notificationRetry = await request("/attempts", {
    method: "POST",
    body: submission(
      "learner-notification-retry",
      "notification-retry-attempt-1",
    ),
  });
  const notificationId = `receipt:${notificationRetry.attempt.id}`;
  const notificationRef = db.collection("notifications").doc(notificationId);
  await eventually(
    "failed notification delivery",
    async () => (await notificationRef.get()).data(),
    (notification) => notification?.status === "failed",
  );
  await request(
    `/notifications/${notificationId}/retry`,
    {
      method: "POST",
      token: evaluatorA.token,
    },
  );
  const scheduleResponse = await fetch(
    `http://127.0.0.1:5101/${PROJECT_ID}/us-central1/retryEvaluationNotifications-0`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "ce-id": "local-notification-retry",
        "ce-source": `//pubsub.googleapis.com/projects/${PROJECT_ID}/topics/firebase-schedule-retryEvaluationNotifications`,
        "ce-specversion": "1.0",
        "ce-type": "google.cloud.pubsub.topic.v1.messagePublished",
      },
      body: JSON.stringify({
        message: {
          data: Buffer.from("{}").toString("base64"),
          messageId: "local-notification-retry",
          publishTime: new Date().toISOString(),
        },
        subscription: "local-emulator",
      }),
    },
  );
  assert.equal(
    scheduleResponse.status,
    200,
    `scheduled retry invocation failed: ${await scheduleResponse.text()}`,
  );
  const sentAfterRetry = await eventually(
    "scheduled notification retry",
    async () => (await notificationRef.get()).data(),
    (notification) => notification?.status === "sent",
  );
  assert.equal(sentAfterRetry.attempts, 2);
  assert.ok(sentAfterRetry.providerMessageId);

  const deliveries = await eventually(
    "receipt and result notification delivery",
    async () => {
      const response = await fetch(`${MOCK}/deliveries`);
      return response.json();
    },
    (items) => {
      const keys = new Set(items.map((item) => item.idempotencyKey));
      return (
        keys.has(`receipt:${first.attempt.id}`) &&
        keys.has(`result:${first.attempt.id}:1`)
      );
    },
  );
  const firstAttemptDeliveries = deliveries.filter((item) =>
    [
      `receipt:${first.attempt.id}`,
      `result:${first.attempt.id}:1`,
    ].includes(item.idempotencyKey),
  );
  assert.deepEqual(
    firstAttemptDeliveries.map((item) => item.idempotencyKey).sort(),
    [`receipt:${first.attempt.id}`, `result:${first.attempt.id}:1`].sort(),
  );

  process.stdout.write(
    "Firebase emulator integration passed: security rules, shared attempts and queries, evaluation retry lineage, claim takeover, idempotent finalization, scheduled notification retry, and credential privacy/rotation/revocation.\n",
  );
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
