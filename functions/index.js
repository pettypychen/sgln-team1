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

const DEFAULT_MODELS = {
  anthropic: "claude-sonnet-5",
  zai: "glm-4.5-flash",
  alibaba: "qwen3.7-flash",
  openrouter: "deepseek/deepseek-r1",
};

const MAX_TOKENS = 700;

const MODEL_ENV = { anthropic: "ANTHROPIC_MODEL", zai: "ZAI_MODEL", alibaba: "ALIBABA_MODEL", openrouter: "OPENROUTER_MODEL" };
function resolvedModel(provider) {
  const key = MODEL_ENV[provider];
  return (key && process.env[key]) || DEFAULT_MODELS[provider] || provider;
}

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

async function callAnthropic(apiKey, system, messages) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || DEFAULT_MODELS.anthropic,
      max_tokens: MAX_TOKENS,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error (${response.status})`);
  }
  const data = await response.json();
  return (data.content?.[0]?.text || "").trim();
}

async function callZai(apiKey, system, messages) {
  const response = await fetch("https://api.z.ai/api/paas/v4/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.ZAI_MODEL || DEFAULT_MODELS.zai,
      max_tokens: MAX_TOKENS,
      messages: [
        { role: "system", content: system },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Z.ai API error (${response.status})`);
  }
  const data = await response.json();
  return (data.choices?.[0]?.message?.content || "").trim();
}

async function callAlibaba(apiKey, system, messages) {
  const response = await fetch(
    "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.ALIBABA_MODEL || DEFAULT_MODELS.alibaba,
        max_tokens: MAX_TOKENS,
        messages: [
          { role: "system", content: system },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Alibaba Qwen API error (${response.status})`);
  }
  const data = await response.json();
  return (data.choices?.[0]?.message?.content || "").trim();
}

async function callOpenRouter(apiKey, system, messages) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://sgln-team1-f8d61.web.app",
      "X-Title": "SimWorks",
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || DEFAULT_MODELS.openrouter,
      max_tokens: MAX_TOKENS,
      messages: [
        { role: "system", content: system },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API error (${response.status})`);
  }
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

const DISPATCH = {
  anthropic: callAnthropic,
  zai: callZai,
  alibaba: callAlibaba,
  openrouter: callOpenRouter,
};

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
    const logRef = await createAiCallLog({
      callType: "chat",
      provider,
      aiModel: resolvedModel(provider),
      promptPreview,
    });

    try {
      const content = await DISPATCH[provider](apiKey, system, messages);
      await finalizeAiCallLog(logRef, content);
      if (!content) {
        res.status(502).json({ error: "Provider returned an empty response." });
        return;
      }
      res.status(200).json({ content });
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
