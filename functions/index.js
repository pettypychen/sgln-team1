/**
 * Case-agent proxy (Firebase Functions, 2nd gen).
 *
 * The frontend is a static site, so the LLM API keys must never ship to the
 * browser. This HTTPS function holds the keys server-side and dispatches a
 * conversation turn to whichever provider the request asks for.
 *
 * Contract:
 *   POST { provider: "anthropic" | "zai" | "alibaba" | "openrouter",
 *          system: string,
 *          messages: [{ role: "user" | "assistant", content: string }] }
 *   -> 200 { content: string }
 *   -> 4xx/5xx { error: string }
 *
 * Keys are provided as secrets (see README). Models can be overridden with
 * optional *_MODEL environment variables.
 */

const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

if (!getApps().length) initializeApp();
const db = getFirestore();
const { evaluationApi, processEvaluationJob } = require("./evaluation");
const {
  deliverEvaluationNotification,
  retryEvaluationNotifications,
} = require("./notifications");
const { publicCredentialPage } = require("./publicCredential");
const { onSubmissionCreated, onEvaluationRetrigger } = require("./submission-evaluator");

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
const ZAI_API_KEY = defineSecret("ZAI_API_KEY");
const ALIBABA_API_KEY = defineSecret("ALIBABA_API_KEY");
const OPENROUTER_API_KEY = defineSecret("OPENROUTER_API_KEY");

const ALL_SECRETS = [
  ANTHROPIC_API_KEY,
  ZAI_API_KEY,
  ALIBABA_API_KEY,
  OPENROUTER_API_KEY,
];

/**
 * Models to try per provider, in round-robin order.
 * Exhausting all models for a provider causes the caller to fall back to
 * the next provider in the chain.
 */
const PROVIDER_MODELS = {
  alibaba: [
    "qwen3.7-flash",
    "qwen3.7-plus",
    "qwen3.7-plus-2026-05-26",
    "qwen3.7-flash-2026-07-15",
    "qwen3.7-max",
    "qwen3.7-max-2026-06-08",
    "qwen3.7-max-2026-05-20",
    "qwen3.7-max-2026-05-17",
    "qwen3.7-max-preview",
    "qwen3.6-flash",
    "qwen3.6-plus-2026-04-02",
    "qwen3.5-flash",
    "qwen3.5-flash-2026-02-23",
    "qwen3.5-plus",
    "qwen3.5-plus-2026-04-20",
    "qwen3.5-plus-2026-02-15",
    "qwen3.6-max-preview",
    "qwen3.6-27b",
    "qwen3.6-35b-a3b",
    "qwen3.5-27b",
    "qwen3.5-35b-a3b",
    "qwen-plus",
    "qwen-plus-latest",
    "qwen-plus-2025-12-01",
    "qwen-plus-2025-09-11",
    "qwen-plus-2025-07-28",
    "qwen-plus-2025-07-14",
    "qwen-plus-2025-04-28",
    "glm-5.2",
    "glm-5.1",
    "deepseek-v4-flash",
    "deepseek-v4-pro",
    "deepseek-v3.2",
    "qwen3.8-max",
    "qwen3-vl-flash",
    "qwen3-vl-flash-2026-01-22",
    "qwen3-vl-flash-2025-10-15",
    "qwen3-vl-plus",
    "qwen3-vl-plus-2025-12-19",
    "qwen3-vl-plus-2025-09-23",
    "qwen3-max",
    "qwen3-max-preview",
    "qwen3-max-2026-01-23",
    "qwen3-max-2025-09-23",
    "qwen3-14b",
    "qwen3-30b-a3b",
    "qwen3-8b",
    "qwen3-32b",
    "qwen3-235b-a22b",
    "qwen3-coder-plus",
  ],
  zai: [
    "glm-4.5-flash",
  ],
  openrouter: [
    "deepseek/deepseek-r1",
  ],
  anthropic: [
    "claude-sonnet-5",
  ],
};

// Per-provider round-robin counters — persist across warm invocations.
const providerModelIndex = { alibaba: 0, zai: 0, openrouter: 0, anthropic: 0 };

// Models that have errored this instance lifetime — skipped on every subsequent request.
// Reset automatically when all models in a provider pool are exhausted.
const providerFailedModels = {
  alibaba: new Set(),
  zai: new Set(),
  openrouter: new Set(),
  anthropic: new Set(),
};

const MAX_TOKENS = 700;

function nowIso() { return new Date().toISOString(); }

async function createAiCallLog(data) {
  try {
    const ref = db.collection("aiCallLogs").doc();
    await ref.set({
      id: ref.id,
      callType: data.callType,
      submissionId: data.submissionId || "",
      userName: data.userName || "",
      provider: data.provider || "",
      aiModel: data.aiModel || "",
      promptPreview: (data.promptPreview || "").slice(0, 1500),
      status: "processing",
      response: "",
      datetime: nowIso(),
      completedAt: null,
    });
    return ref;
  } catch (err) {
    logger.warn("aiCallLog create failed", { error: err.message });
    return null;
  }
}

async function finalizeAiCallLog(ref, response) {
  if (!ref) return;
  try {
    await ref.update({ status: "complete", response: (response || "").slice(0, 2000), completedAt: nowIso() });
  } catch (err) {
    logger.warn("aiCallLog finalize failed", { error: err.message });
  }
}

/** Reject payloads that are malformed or unreasonably large. */
function validateBody(body) {
  if (!body || typeof body !== "object") {
    return "Request body must be JSON.";
  }
  const { provider, system, messages } = body;
  if (!["anthropic", "zai", "alibaba", "openrouter"].includes(provider)) {
    return "Unknown provider.";
  }
  if (typeof system !== "string" || system.length === 0) {
    return "Missing system prompt.";
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return "Missing messages.";
  }
  if (messages.length > 60) {
    return "Too many messages.";
  }
  for (const message of messages) {
    if (
      !message ||
      (message.role !== "user" && message.role !== "assistant") ||
      typeof message.content !== "string"
    ) {
      return "Malformed message in conversation.";
    }
  }
  return null;
}

// --- Pure HTTP call functions (accept model as param, return content string) ---

async function callAnthropic(apiKey, system, messages, model) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });
  if (!response.ok) throw new Error(`Anthropic API error (${response.status})`);
  const data = await response.json();
  return (data.content?.[0]?.text || "").trim();
}

async function callZai(apiKey, system, messages, model) {
  const response = await fetch("https://api.z.ai/api/paas/v4/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "system", content: system }, ...messages.map((m) => ({ role: m.role, content: m.content }))],
    }),
  });
  if (!response.ok) throw new Error(`Z.ai API error (${response.status})`);
  const data = await response.json();
  return (data.choices?.[0]?.message?.content || "").trim();
}

async function callAlibaba(apiKey, system, messages, model) {
  const response = await fetch(
    "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
    {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        max_tokens: MAX_TOKENS,
        messages: [{ role: "system", content: system }, ...messages.map((m) => ({ role: m.role, content: m.content }))],
      }),
    },
  );
  if (!response.ok) throw new Error(`Alibaba Qwen API error (${response.status})`);
  const data = await response.json();
  return (data.choices?.[0]?.message?.content || "").trim();
}

async function callOpenRouter(apiKey, system, messages, model) {
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
      max_tokens: MAX_TOKENS,
      messages: [{ role: "system", content: system }, ...messages.map((m) => ({ role: m.role, content: m.content }))],
    }),
  });
  if (!response.ok) throw new Error(`OpenRouter API error (${response.status})`);
  const data = await response.json();
  const msg = data.choices?.[0]?.message;
  return (msg?.content ?? msg?.reasoning_content ?? "").trim();
}

const KEY_FOR_PROVIDER = {
  anthropic: ANTHROPIC_API_KEY,
  zai: ZAI_API_KEY,
  alibaba: ALIBABA_API_KEY,
  openrouter: OPENROUTER_API_KEY,
};

const HTTP_CALL = { anthropic: callAnthropic, zai: callZai, alibaba: callAlibaba, openrouter: callOpenRouter };

/**
 * Try every model for a provider in round-robin order. Returns { content, model }
 * on first success; throws only when all models have failed.
 */
async function callProviderWithModelFallback(provider, apiKey, system, messages) {
  const models = PROVIDER_MODELS[provider];
  const failed = providerFailedModels[provider];

  // If every model has been marked failed, reset so they get a fresh chance.
  if (failed.size >= models.length) {
    logger.warn(`${provider}: all models previously failed — resetting failed set`);
    failed.clear();
    providerModelIndex[provider] = 0;
  }

  const startIdx = providerModelIndex[provider];
  let lastError;
  for (let i = 0; i < models.length; i++) {
    const idx = (startIdx + i) % models.length;
    const model = models[idx];
    if (failed.has(model)) continue;
    try {
      const content = await HTTP_CALL[provider](apiKey, system, messages, model);
      if (!content) throw new Error(`${provider} model ${model} returned empty response`);
      // Success: stay on this model for the next request.
      providerModelIndex[provider] = idx;
      return { content, model };
    } catch (err) {
      logger.warn(`${provider} model ${model} failed — marking as unavailable`, { error: err.message });
      lastError = err;
      failed.add(model);
      providerModelIndex[provider] = (idx + 1) % models.length;
    }
  }
  throw lastError ?? new Error(`All ${provider} models failed.`);
}

exports.agentChat = onRequest(
  {
    secrets: ALL_SECRETS,
    cors: true,
    region: "us-central1",
  },
  async (req, res) => {
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    // GET /api/agent → return which providers have a Firebase secret configured.
    // The frontend calls this on mount to populate the provider dropdown without
    // needing any VITE_*_API_KEY baked into the production build.
    if (req.method === "GET") {
      const configured = Object.entries(KEY_FOR_PROVIDER)
        .filter(([, secret]) => {
          try { return Boolean(secret.value()); } catch { return false; }
        })
        .map(([provider]) => provider);
      res.status(200).json({ providers: configured });
      return;
    }

    if (req.method !== "POST") {
      res.status(405).json({ error: "Use POST for chat, GET for provider list." });
      return;
    }

    const validationError = validateBody(req.body);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    const { provider, system, messages } = req.body;
    const apiKey = KEY_FOR_PROVIDER[provider].value();
    if (!apiKey) {
      res.status(503).json({
        error: `No API key configured for ${provider}.`,
      });
      return;
    }

    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const promptPreview = `[System]: ${system.slice(0, 300)}\n\n[User]: ${lastUserMsg.slice(0, 500)}`;
    const logRef = await createAiCallLog({ callType: "chat", provider, aiModel: "", promptPreview });

    try {
      const { content, model } = await callProviderWithModelFallback(provider, apiKey, system, messages);
      await finalizeAiCallLog(logRef, content);
      // Patch the actual model used into the log (set after call so round-robin is accurate).
      if (logRef) logRef.update({ aiModel: model }).catch(() => {});
      res.status(200).json({ content, model });
    } catch (error) {
      await finalizeAiCallLog(logRef, `Error: ${error.message}`);
      logger.error("agentChat failed", { provider, message: error.message });
      res.status(502).json({ error: "The AI provider request failed." });
    }
  },
);

exports.evaluationApi = evaluationApi;
exports.processEvaluationJob = processEvaluationJob;
exports.deliverEvaluationNotification = deliverEvaluationNotification;
exports.retryEvaluationNotifications = retryEvaluationNotifications;
exports.publicCredentialPage = publicCredentialPage;
exports.onSubmissionCreated = onSubmissionCreated;
exports.onEvaluationRetrigger = onEvaluationRetrigger;
