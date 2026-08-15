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

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
const ZAI_API_KEY = defineSecret("ZAI_API_KEY");
const ALIBABA_API_KEY = defineSecret("ALIBABA_API_KEY");
const OPENROUTER_API_KEY = defineSecret("OPENROUTER_API_KEY");

const ALL_SECRETS = [ANTHROPIC_API_KEY, ZAI_API_KEY, ALIBABA_API_KEY, OPENROUTER_API_KEY];

/**
 * Same provider model lists as the chat (index.js), so evaluation and chat
 * round-robin across the same pool. Each provider's list is tried in order;
 * the first model to succeed is reused for subsequent requests on this instance.
 */
const PROVIDER_MODELS = {
  alibaba: [
    "qwen3.7-flash",
    "qwen3.7-plus",
    "qwen3.7-flash-2026-07-15",
    "qwen3.7-max",
    "qwen3.6-flash",
    "qwen3.5-flash",
    "qwen3.5-plus",
    "qwen-plus",
    "qwen-plus-latest",
  ],
  zai: ["glm-4.5-flash"],
  openrouter: ["deepseek/deepseek-r1"],
  anthropic: ["claude-sonnet-5"],
};

// Same fallback order as the chat frontend.
const EVAL_FALLBACK_CHAIN = ["alibaba", "zai", "openrouter", "anthropic"];

// Per-provider round-robin state — persists across warm invocations.
const evalProviderModelIndex = { alibaba: 0, zai: 0, openrouter: 0, anthropic: 0 };
const evalProviderFailedModels = {
  alibaba: new Set(),
  zai: new Set(),
  openrouter: new Set(),
  anthropic: new Set(),
};

const EVAL_MAX_TOKENS = 4000;

function iso() { return new Date().toISOString(); }
function genId(prefix) { return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`; }

// --- Provider call functions (single-turn, JSON output) ---

async function callAnthropicEval(apiKey, userMessage, model) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model,
      max_tokens: EVAL_MAX_TOKENS,
      system: EVALUATION_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) throw new Error(`Anthropic API error (${response.status})`);
  const data = await response.json();
  return (data.content?.[0]?.text || "").trim();
}

async function callZaiEval(apiKey, userMessage, model) {
  const response = await fetch("https://api.z.ai/api/paas/v4/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      max_tokens: EVAL_MAX_TOKENS,
      messages: [
        { role: "system", content: EVALUATION_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) throw new Error(`Z.ai API error (${response.status})`);
  const data = await response.json();
  const msg = data.choices?.[0]?.message;
  // GLM thinking models may return the answer in reasoning_content when content is empty.
  return (msg?.content?.trim() || msg?.reasoning_content?.trim()) ?? "";
}

async function callAlibabaEval(apiKey, userMessage, model) {
  const response = await fetch("https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      max_tokens: EVAL_MAX_TOKENS,
      messages: [
        { role: "system", content: EVALUATION_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) throw new Error(`Alibaba API error (${response.status})`);
  const data = await response.json();
  return (data.choices?.[0]?.message?.content || "").trim();
}

async function callOpenRouterEval(apiKey, userMessage, model) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://sgln-team1-f8d61.web.app",
      "X-Title": "SimWorks",
    },
    body: JSON.stringify({
      model,
      max_tokens: EVAL_MAX_TOKENS,
      messages: [
        { role: "system", content: EVALUATION_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) throw new Error(`OpenRouter API error (${response.status})`);
  const data = await response.json();
  const msg = data.choices?.[0]?.message;
  return (msg?.content?.trim() || msg?.reasoning_content?.trim()) ?? "";
}

const EVAL_HTTP_CALL = {
  anthropic: callAnthropicEval,
  zai: callZaiEval,
  alibaba: callAlibabaEval,
  openrouter: callOpenRouterEval,
};

const EVAL_KEY_FOR = {
  anthropic: ANTHROPIC_API_KEY,
  zai: ZAI_API_KEY,
  alibaba: ALIBABA_API_KEY,
  openrouter: OPENROUTER_API_KEY,
};

/**
 * Try every model for one provider in round-robin order.
 * Returns { content, model } on first success; throws when all models fail.
 */
async function callEvalProviderWithModelFallback(provider, apiKey, userMessage) {
  const models = PROVIDER_MODELS[provider];
  const failed = evalProviderFailedModels[provider];

  if (failed.size >= models.length) {
    logger.warn(`eval ${provider}: all models failed — resetting`);
    failed.clear();
    evalProviderModelIndex[provider] = 0;
  }

  const startIdx = evalProviderModelIndex[provider];
  let lastError;
  for (let i = 0; i < models.length; i++) {
    const idx = (startIdx + i) % models.length;
    const model = models[idx];
    if (failed.has(model)) continue;
    try {
      const content = await EVAL_HTTP_CALL[provider](apiKey, userMessage, model);
      if (!content) throw new Error(`${provider}/${model} returned empty response`);
      evalProviderModelIndex[provider] = idx;
      return { content, model };
    } catch (err) {
      logger.warn(`eval ${provider}/${model} failed`, { error: err.message });
      lastError = err;
      failed.add(model);
      evalProviderModelIndex[provider] = (idx + 1) % models.length;
    }
  }
  throw lastError ?? new Error(`All ${provider} models failed.`);
}

/**
 * Try providers in the fallback chain until one succeeds.
 * Skips providers whose API key is not configured.
 */
async function callEvalWithFallback(userMessage) {
  for (const provider of EVAL_FALLBACK_CHAIN) {
    const apiKey = EVAL_KEY_FOR[provider].value();
    if (!apiKey) continue;
    try {
      const { content, model } = await callEvalProviderWithModelFallback(provider, apiKey, userMessage);
      return { content, provider, model };
    } catch (err) {
      logger.warn(`eval provider ${provider} exhausted`, { error: err.message });
    }
  }
  throw new Error("All evaluation providers failed.");
}

// --- Evaluation logic ---

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
  const recommendation = casePassed && interactionPassed ? "pass"
    : casePassed || interactionPassed ? "remediation_required"
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

function parseEvaluationResponse(rawText) {
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/\s*```$/m, "")
    .trim();
  return JSON.parse(cleaned);
}

/**
 * Core evaluation pipeline. Shared by the automatic trigger (onSubmissionCreated)
 * and the manual retrigger (onEvaluationRetrigger).
 */
async function runEvaluationForSubmission(submissionId, submission) {
  const submissionRef = db.collection("submissions").doc(submissionId);
  const { caseId, displayName, caseTitle, workProduct, attemptId, attemptNumber } = submission;
  const casePackage = CASE_PACKAGES[caseId];

  if (!casePackage) {
    logger.warn("Unknown case — skipping AI evaluation", { submissionId, caseId });
    await submissionRef.update({ evaluationStatus: "ai_failed" });
    return;
  }

  const evaluationId = genId("eval");
  const evaluationRef = db.collection("evaluations").doc(evaluationId);
  const startedAt = iso();
  const submittedAt = submission.submittedAt?.toDate?.()?.toISOString() ?? iso();

  const initialRun = {
    id: genId("run"),
    provider: "auto",
    model: "auto",
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

  logger.info("AI evaluation started", { submissionId, evaluationId, caseId });

  try {
    const userMessage = buildUserMessage(casePackage, {
      displayName: displayName || "",
      caseTitle: caseTitle || casePackage.title,
      workProduct: workProduct || "",
      attemptNumber: attemptNumber ?? 1,
    });

    const aiLogRef = db.collection("aiCallLogs").doc();
    await aiLogRef.set({
      id: aiLogRef.id,
      callType: "evaluation",
      submissionId,
      userName: displayName || "",
      provider: "auto",
      aiModel: "auto",
      promptPreview: userMessage.slice(0, 1500),
      status: "processing",
      response: "",
      datetime: iso(),
      completedAt: null,
    }).catch(() => {});

    let rawText, provider, model;
    try {
      ({ content: rawText, provider, model } = await callEvalWithFallback(userMessage));
      await aiLogRef.update({ provider, aiModel: model, status: "complete", response: rawText.slice(0, 2000), completedAt: iso() }).catch(() => {});
    } catch (aiError) {
      await aiLogRef.update({ status: "complete", response: `Error: ${aiError.message}`, completedAt: iso() }).catch(() => {});
      throw aiError;
    }

    let parsed;
    try {
      parsed = parseEvaluationResponse(rawText);
    } catch {
      throw new Error(`AI response was not valid JSON: ${rawText.slice(0, 300)}`);
    }

    const rawAssessments = Array.isArray(parsed?.assessments) ? parsed.assessments : [];
    const assessments = rawAssessments.map((a) => ({
      criterionId: String(a.criterionId || ""),
      points: Number(a.points ?? 0),
      explanation: String(a.explanation || ""),
      evidence: [],
      supported: true,
    }));

    const { caseScore, interactionScore, recommendation } = scoreAssessments(casePackage.rubric, assessments);
    const completedAt = iso();
    const completedRun = {
      ...initialRun,
      provider,
      model,
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
      evaluationRef.update({ status: "ready_for_review", evaluationRuns: [completedRun], updatedAt: completedAt }),
    ]);

    logger.info("AI evaluation completed", { submissionId, evaluationId, provider, model, caseScore, interactionScore, recommendation });
  } catch (error) {
    const failedAt = iso();
    const failedRun = { ...initialRun, completedAt: failedAt, status: "failed", validationErrors: [error.message] };
    await Promise.all([
      submissionRef.update({ evaluationStatus: "ai_failed" }),
      evaluationRef.update({ status: "ai_failed", evaluationRuns: [failedRun], updatedAt: failedAt }),
    ]);
    logger.error("AI evaluation failed", { submissionId, evaluationId, error: error.message });
  }
}

exports.onSubmissionCreated = onDocumentCreated(
  {
    document: "submissions/{submissionId}",
    secrets: ALL_SECRETS,
    region: "us-central1",
    retry: false,
    timeoutSeconds: 120,
  },
  async (event) => {
    const submissionId = event.params.submissionId;
    const submission = event.data.data();
    if (!submission) { logger.error("Submission data missing", { submissionId }); return; }
    await runEvaluationForSubmission(submissionId, submission);
  },
);

exports.onEvaluationRetrigger = onDocumentCreated(
  {
    document: "evaluationRetriggers/{submissionId}",
    secrets: ALL_SECRETS,
    region: "us-central1",
    retry: false,
    timeoutSeconds: 120,
  },
  async (event) => {
    const submissionId = event.params.submissionId;
    const retriggerRef = event.data.ref;
    try {
      const submissionSnap = await db.collection("submissions").doc(submissionId).get();
      if (!submissionSnap.exists) { logger.warn("Submission not found for retrigger", { submissionId }); return; }
      await runEvaluationForSubmission(submissionId, submissionSnap.data());
    } finally {
      await retriggerRef.delete().catch(() => {});
    }
  },
);
