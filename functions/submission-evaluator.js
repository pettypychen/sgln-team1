"use strict";

const crypto = require("node:crypto");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const CASE_PACKAGES = require("./generated/cases.json");

if (!getApps().length) initializeApp();
const db = getFirestore();

// AI evaluator configuration — add entries here as new providers are enabled.
// Only the first enabled config is used per evaluation run.
const AI_EVALUATOR_CONFIGS = [
  { provider: "zai", model: "glm-4.5-flash", enabled: true },
];

const ZAI_API_KEY = defineSecret("ZAI_API_KEY");

const ACTIVE_CONFIG = AI_EVALUATOR_CONFIGS.find((c) => c.enabled) || null;

function iso() {
  return new Date().toISOString();
}

function genId(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

function scoreAssessments(rubric, assessments) {
  const byId = new Map(assessments.map((a) => [a.criterionId, a]));
  let caseScore = 0;
  let interactionScore = 0;
  for (const criterion of rubric.criteria) {
    const a = byId.get(criterion.id);
    const points = Math.max(0, Math.min(criterion.maxPoints, Number(a?.points ?? 0)));
    if (criterion.dimension === "case_outcome") caseScore += points;
    else interactionScore += points;
  }
  const casePassed = caseScore >= rubric.caseThreshold;
  const interactionPassed = interactionScore >= rubric.interactionThreshold;
  const recommendation =
    casePassed && interactionPassed
      ? "pass"
      : casePassed || interactionPassed
        ? "remediation_required"
        : "not_yet_ready";
  return { caseScore, interactionScore, recommendation };
}

function buildUserMessage(casePackage, submission) {
  const rubricText = JSON.stringify(casePackage.rubric, null, 2);
  return [
    `## Evaluation Instructions\n${casePackage.evaluationPrompt}`,
    `## Evaluation Guidance\n${casePackage.evaluationGuidance}`,
    `## Rubric\n\`\`\`json\n${rubricText}\n\`\`\``,
    [
      "## Submission",
      `Learner: ${submission.displayName}`,
      `Case: ${submission.caseTitle}`,
      `Attempt: #${submission.attemptNumber}`,
      "",
      "### Work Product",
      submission.workProduct,
    ].join("\n"),
  ].join("\n\n");
}

const EVALUATION_SYSTEM_PROMPT = `You are an expert evaluator for SimWorks workplace simulations. Evaluate the submitted work product strictly against the supplied rubric and guidance.

Return ONLY a valid JSON object — no markdown fences, no text outside the JSON. Use this exact structure:
{
  "assessments": [
    {
      "criterionId": "<exact id from rubric>",
      "points": <integer 0 to maxPoints>,
      "explanation": "<one to three sentences explaining the score>"
    }
  ],
  "summary": "<two to four sentences summarising overall performance>"
}

Score every criterion listed in the rubric. Do not omit any criterion and do not add criteria that are not in the rubric.`;

async function callZaiEvaluator(apiKey, userMessage) {
  const model = ACTIVE_CONFIG.model;
  const response = await fetch(
    "https://api.z.ai/api/paas/v4/chat/completions",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 4000,
        messages: [
          { role: "system", content: EVALUATION_SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
      }),
      signal: AbortSignal.timeout(90_000),
    },
  );

  if (!response.ok) {
    throw new Error(`Z.ai API error (${response.status})`);
  }
  const data = await response.json();
  const msg = data.choices?.[0]?.message;
  // GLM thinking models may return the answer in reasoning_content when content is empty.
  return (msg?.content?.trim() || msg?.reasoning_content?.trim()) ?? "";
}

function parseEvaluationResponse(rawText) {
  // Strip markdown code fences if the model wraps the JSON.
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/\s*```$/m, "")
    .trim();
  return JSON.parse(cleaned);
}

exports.onSubmissionCreated = onDocumentCreated(
  {
    document: "submissions/{submissionId}",
    secrets: [ZAI_API_KEY],
    region: "us-central1",
    retry: false,
    timeoutSeconds: 120,
  },
  async (event) => {
    const submissionId = event.params.submissionId;
    const submissionRef = db.collection("submissions").doc(submissionId);
    const submission = event.data.data();

    if (!submission) {
      logger.error("Submission data missing", { submissionId });
      return;
    }

    const { caseId, displayName, caseTitle, workProduct, attemptId, attemptNumber } = submission;
    const casePackage = CASE_PACKAGES[caseId];

    if (!casePackage) {
      logger.warn("Unknown case — skipping AI evaluation", { submissionId, caseId });
      await submissionRef.update({ evaluationStatus: "ai_failed" });
      return;
    }

    if (!ACTIVE_CONFIG) {
      logger.warn("No AI evaluator configured — skipping evaluation", { submissionId });
      await submissionRef.update({ evaluationStatus: "ai_failed" });
      return;
    }

    const evaluationId = genId("eval");
    const evaluationRef = db.collection("evaluations").doc(evaluationId);
    const startedAt = iso();
    const submittedAt =
      submission.submittedAt?.toDate?.()?.toISOString() ?? iso();

    const initialRun = {
      id: genId("run"),
      provider: ACTIVE_CONFIG.provider,
      model: ACTIVE_CONFIG.model,
      promptVersion: "1.0.0",
      startedAt,
      completedAt: null,
      status: "processing",
      assessments: [],
      caseScore: 0,
      interactionScore: 0,
      recommendation: null,
      validationErrors: [],
    };

    // Step 1: Mark as processing and create the evaluation record atomically.
    await Promise.all([
      submissionRef.update({ evaluationStatus: "ai_processing" }),
      evaluationRef.set({
        id: evaluationId,
        submissionId,
        attemptId: attemptId || null,
        displayName: displayName || "",
        caseId,
        caseTitle: caseTitle || casePackage.title,
        category: casePackage.category || "",
        workProduct: workProduct || "",
        attemptNumber: attemptNumber ?? 1,
        submittedAt,
        status: "ai_processing",
        evaluationRuns: [initialRun],
        review: null,
        createdAt: startedAt,
        updatedAt: startedAt,
      }),
    ]);

    logger.info("AI evaluation started", {
      submissionId,
      evaluationId,
      caseId,
      provider: ACTIVE_CONFIG.provider,
      model: ACTIVE_CONFIG.model,
    });

    // Step 2: Run AI evaluation.
    try {
      const userMessage = buildUserMessage(casePackage, {
        displayName: displayName || "",
        caseTitle: caseTitle || casePackage.title,
        workProduct: workProduct || "",
        attemptNumber: attemptNumber ?? 1,
      });

      const rawText = await callZaiEvaluator(ZAI_API_KEY.value(), userMessage);

      let parsed;
      try {
        parsed = parseEvaluationResponse(rawText);
      } catch {
        throw new Error(
          `AI response was not valid JSON: ${rawText.slice(0, 300)}`,
        );
      }

      const rawAssessments = Array.isArray(parsed?.assessments)
        ? parsed.assessments
        : [];
      const assessments = rawAssessments.map((a) => ({
        criterionId: String(a.criterionId || ""),
        points: Number(a.points ?? 0),
        explanation: String(a.explanation || ""),
        evidence: [],
        supported: true,
      }));

      const { caseScore, interactionScore, recommendation } = scoreAssessments(
        casePackage.rubric,
        assessments,
      );
      const completedAt = iso();
      const completedRun = {
        ...initialRun,
        completedAt,
        status: "completed",
        assessments,
        caseScore,
        interactionScore,
        recommendation,
        validationErrors: [],
        rawResponse: rawText,
        aiSummary: String(parsed?.summary || ""),
      };

      await Promise.all([
        submissionRef.update({ evaluationStatus: "ready_for_review" }),
        evaluationRef.update({
          status: "ready_for_review",
          evaluationRuns: [completedRun],
          updatedAt: completedAt,
        }),
      ]);

      logger.info("AI evaluation completed", {
        submissionId,
        evaluationId,
        caseScore,
        interactionScore,
        recommendation,
      });
    } catch (error) {
      const failedAt = iso();
      const failedRun = {
        ...initialRun,
        completedAt: failedAt,
        status: "failed",
        validationErrors: [error.message],
      };
      await Promise.all([
        submissionRef.update({ evaluationStatus: "ai_failed" }),
        evaluationRef.update({
          status: "ai_failed",
          evaluationRuns: [failedRun],
          updatedAt: failedAt,
        }),
      ]);
      logger.error("AI evaluation failed", {
        submissionId,
        evaluationId,
        error: error.message,
      });
    }
  },
);
