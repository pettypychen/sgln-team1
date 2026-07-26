"use strict";

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const { getFirestore } = require("firebase-admin/firestore");
const { derivePrivateToken } = require("./token");

const db = getFirestore();
const PRIVATE_TOKEN_SECRET = defineSecret("PRIVATE_TOKEN_SECRET");
const EMAIL_DELIVERY_API_KEY = defineSecret("EMAIL_DELIVERY_API_KEY");
const DELIVERY_LEASE_MS = 5 * 60 * 1000;

function privateToken(participantId, version = 1) {
  return derivePrivateToken(
    participantId,
    version,
    PRIVATE_TOKEN_SECRET.value(),
  );
}

function outcomeLabel(outcome) {
  if (outcome === "pass") return "Pass";
  if (outcome === "remediation_required") return "Remediation required";
  return "Not yet ready";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildEmail(
  notification,
  attempt,
  participant,
  collectionToken = privateToken(
    attempt.participantId,
    participant.privateTokenVersion || 1,
  ),
) {
  const appUrl = (process.env.PUBLIC_APP_URL || "https://sgln-team1-f8d61.web.app").replace(/\/$/, "");
  const collectionUrl = `${appUrl}/credentials#${encodeURIComponent(collectionToken)}`;
  if (notification.kind === "submission_receipt") {
    const subject = `Submission received: ${attempt.caseTitle}`;
    const text = [
      `Hello ${attempt.learnerDisplayName},`,
      "",
      `We received attempt #${attempt.attemptNumber} for ${attempt.caseTitle}.`,
      `Submitted: ${attempt.submittedAt}`,
      "Your snapshot is immutable and is now moving through AI-assisted, human-final review.",
      `Private results: ${collectionUrl}`,
      "",
      "Keep this private bearer link safe. Do not forward it.",
    ].join("\n");
    return {
      to: participant.email,
      subject,
      text,
      html: `<p>Hello ${escapeHtml(attempt.learnerDisplayName)},</p>
<p>We received attempt <strong>#${escapeHtml(attempt.attemptNumber)}</strong> for <strong>${escapeHtml(attempt.caseTitle)}</strong>.</p>
<p>Your snapshot is immutable and is now moving through AI-assisted, human-final review.</p>
<p><a href="${escapeHtml(collectionUrl)}">Open private results</a></p>
<p><small>Keep this private bearer link safe. Do not forward it.</small></p>`,
    };
  }
  const outcome = outcomeLabel(attempt.review.outcome);
  const badgeLine =
    attempt.review.outcome === "pass"
      ? "A case-specific SimWorks badge has been added to your private collection."
      : attempt.review.outcome === "remediation_required"
        ? "Open your feedback to start a fresh linked attempt."
        : "Open your feedback for the evaluator's recommended next step.";
  const text = [
    `Hello ${attempt.learnerDisplayName},`,
    "",
    `${outcome} · ${attempt.caseTitle}`,
    String(attempt.review.summary || "").trim(),
    badgeLine,
    `Private credentials and feedback: ${collectionUrl}`,
    "",
    "This email intentionally excludes your transcript, detailed evidence, and scores.",
  ].join("\n");
  const badgePreview =
    attempt.review.outcome === "pass"
      ? `<img src="${escapeHtml(appUrl)}/credential-social-card.png" width="600" height="315" alt="SimWorks case credential preview" style="display:block;width:100%;max-width:600px;height:auto;border-radius:16px">`
      : "";
  return {
    to: participant.email,
    subject: `${outcome}: ${attempt.caseTitle}`,
    text,
    html: `<p>Hello ${escapeHtml(attempt.learnerDisplayName)},</p>
<h1>${escapeHtml(outcome)} · ${escapeHtml(attempt.caseTitle)}</h1>
<p>${escapeHtml(String(attempt.review.summary || "").trim())}</p>
${badgePreview}
<p>${escapeHtml(badgeLine)}</p>
<p><a href="${escapeHtml(collectionUrl)}">Open private credentials and feedback</a></p>
<p><small>This email intentionally excludes your transcript, detailed evidence, and scores.</small></p>`,
  };
}

async function deliverNotification(notificationRef) {
  const claimed = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(notificationRef);
    const notification = snapshot.data();
    if (!notification || notification.status === "sent") return null;
    if (
      notification.nextAttemptAt &&
      new Date(notification.nextAttemptAt).getTime() > Date.now()
    ) {
      return null;
    }
    if (
      notification.status === "sending" &&
      new Date(notification.leaseExpiresAt || 0).getTime() > Date.now()
    ) {
      return null;
    }
    transaction.update(notificationRef, {
      status: "sending",
      leaseExpiresAt: new Date(Date.now() + DELIVERY_LEASE_MS).toISOString(),
      attempts: (notification.attempts || 0) + 1,
      lastAttemptAt: new Date().toISOString(),
    });
    return notification;
  });
  if (!claimed) return;

  try {
    const attemptSnapshot = await db.collection("attempts").doc(claimed.attemptId).get();
    if (!attemptSnapshot.exists) {
      throw new Error("Notification attempt not found.");
    }
    const attempt = attemptSnapshot.data();
    if (claimed.kind === "result" && attempt.review?.status !== "final") {
      throw new Error("Refusing to send a provisional result.");
    }
    const participantSnapshot = await db.collection("participants").doc(attempt.participantId).get();
    const participant = participantSnapshot.data();
    if (!participant?.email) {
      throw new Error("Participant email not found.");
    }
    const endpoint = process.env.EMAIL_DELIVERY_ENDPOINT;
    if (!endpoint) {
      throw new Error("EMAIL_DELIVERY_ENDPOINT is not configured.");
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${EMAIL_DELIVERY_API_KEY.value()}`,
        "idempotency-key": claimed.id,
      },
      body: JSON.stringify({
        ...buildEmail(claimed, attempt, participant),
        idempotencyKey: claimed.id,
      }),
      signal: AbortSignal.timeout(
        Number(process.env.EMAIL_DELIVERY_TIMEOUT_MS || 30_000),
      ),
    });
    if (!response.ok) throw new Error(`Email provider returned ${response.status}.`);
    const providerResult = await response.json().catch(() => ({}));
    await notificationRef.update({
      status: "sent",
      sentAt: new Date().toISOString(),
      providerMessageId: providerResult.id || null,
      leaseExpiresAt: null,
      error: null,
      nextAttemptAt: null,
    });
    return true;
  } catch (error) {
    const retryDelayMs = Math.min(
      60 * 60 * 1000,
      2 ** Math.min((claimed.attempts || 0) + 1, 6) * 60 * 1000,
    );
    await notificationRef.update({
      status: "failed",
      error: error.message,
      leaseExpiresAt: null,
      nextAttemptAt: new Date(Date.now() + retryDelayMs).toISOString(),
    });
    logger.error("Evaluation notification delivery failed", {
      notificationId: claimed.id,
      message: error.message,
    });
    throw error;
  }
}

exports.deliverEvaluationNotification = onDocumentCreated(
  {
    document: "notifications/{notificationId}",
    secrets: [PRIVATE_TOKEN_SECRET, EMAIL_DELIVERY_API_KEY],
    region: "us-central1",
    retry: true,
  },
  async (event) => {
    await deliverNotification(event.data.ref);
  },
);

exports.retryEvaluationNotifications = onSchedule(
  {
    schedule: "every 5 minutes",
    secrets: [PRIVATE_TOKEN_SECRET, EMAIL_DELIVERY_API_KEY],
    region: "us-central1",
    timeoutSeconds: 120,
  },
  async () => {
    const snapshot = await db
      .collection("notifications")
      .where("status", "in", ["queued", "failed"])
      .limit(50)
      .get();
    for (const notification of snapshot.docs) {
      try {
        await deliverNotification(notification.ref);
      } catch {
        // Each record retains its own error and backoff. Continue the batch.
      }
    }
  },
);

exports._test = { buildEmail, escapeHtml, outcomeLabel };
