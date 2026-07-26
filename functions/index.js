/**
 * Case-agent proxy (Firebase Functions, 2nd gen).
 *
 * The frontend is a static site, so the LLM API keys must never ship to the
 * browser. This HTTPS function holds the keys server-side and dispatches a
 * conversation turn to whichever provider the request asks for.
 *
 * Contract:
 *   POST { provider: "anthropic" | "openai" | "gemini" | "zai" | "alibaba" | "openrouter",
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

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const ZAI_API_KEY = defineSecret("ZAI_API_KEY");
const ALIBABA_API_KEY = defineSecret("ALIBABA_API_KEY");
const OPENROUTER_API_KEY = defineSecret("OPENROUTER_API_KEY");

const ALL_SECRETS = [
  ANTHROPIC_API_KEY,
  OPENAI_API_KEY,
  GEMINI_API_KEY,
  ZAI_API_KEY,
  ALIBABA_API_KEY,
  OPENROUTER_API_KEY,
];

const DEFAULT_MODELS = {
  anthropic: "claude-sonnet-5",
  openai: "gpt-4o",
  gemini: "gemini-2.0-flash",
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
  if (!["anthropic", "openai", "gemini", "zai", "alibaba", "openrouter"].includes(provider)) {
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
      messages: messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error (${response.status})`);
  }
  const data = await response.json();
  const text = (data.content || [])
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
  return text;
}

async function callOpenAI(apiKey, system, messages) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || DEFAULT_MODELS.openai,
      max_tokens: MAX_TOKENS,
      messages: [
        { role: "system", content: system },
        ...messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error (${response.status})`);
  }
  const data = await response.json();
  return (data.choices?.[0]?.message?.content || "").trim();
}

async function callGemini(apiKey, system, messages) {
  const model = process.env.GEMINI_MODEL || DEFAULT_MODELS.gemini;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map((message) => ({
        // Gemini uses "model" for the assistant role.
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
      })),
      generationConfig: { maxOutputTokens: MAX_TOKENS },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API error (${response.status})`);
  }
  const data = await response.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  return parts
    .map((part) => part.text || "")
    .join("\n")
    .trim();
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
  openai: OPENAI_API_KEY,
  gemini: GEMINI_API_KEY,
  zai: ZAI_API_KEY,
  alibaba: ALIBABA_API_KEY,
  openrouter: OPENROUTER_API_KEY,
};

const DISPATCH = {
  anthropic: callAnthropic,
  openai: callOpenAI,
  gemini: callGemini,
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
