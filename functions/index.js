/**
 * Case-agent proxy (Firebase Functions, 2nd gen).
 *
 * The frontend is a static site, so the LLM API keys must never ship to the
 * browser. This HTTPS function holds the keys server-side and dispatches a
 * conversation turn to whichever provider the request asks for.
 *
 * Contract:
 *   POST { provider: "zai" | "alibaba" | "openrouter",
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
const { evaluationApi, processEvaluationJob } = require("./evaluation");
const {
  deliverEvaluationNotification,
  retryEvaluationNotifications,
} = require("./notifications");
const { publicCredentialPage } = require("./publicCredential");
const { onSubmissionCreated, onEvaluationRetrigger } = require("./submission-evaluator");

const ZAI_API_KEY = defineSecret("ZAI_API_KEY");
const ALIBABA_API_KEY = defineSecret("ALIBABA_API_KEY");
const OPENROUTER_API_KEY = defineSecret("OPENROUTER_API_KEY");

const ALL_SECRETS = [
  ZAI_API_KEY,
  ALIBABA_API_KEY,
  OPENROUTER_API_KEY,
];

const DEFAULT_MODELS = {
  zai: "glm-4.5-flash",
  alibaba: "qwen3.7-flash",
  openrouter: "deepseek/deepseek-r1",
};

const MAX_TOKENS = 700;

/** Reject payloads that are malformed or unreasonably large. */
function validateBody(body) {
  if (!body || typeof body !== "object") {
    return "Request body must be JSON.";
  }
  const { provider, system, messages } = body;
  if (!["zai", "alibaba", "openrouter"].includes(provider)) {
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
  zai: ZAI_API_KEY,
  alibaba: ALIBABA_API_KEY,
  openrouter: OPENROUTER_API_KEY,
};

const DISPATCH = {
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

    try {
      const content = await DISPATCH[provider](apiKey, system, messages);
      if (!content) {
        res.status(502).json({ error: "Provider returned an empty response." });
        return;
      }
      res.status(200).json({ content });
    } catch (error) {
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
