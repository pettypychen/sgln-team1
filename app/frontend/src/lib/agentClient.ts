/**
 * Provider-agnostic client for the case agent.
 *
 * Priority order:
 *   1. VITE_AGENT_ENDPOINT set → call the serverless proxy (production / staging)
 *   2. VITE_*_API_KEY set → call the provider directly (local dev shortcut)
 *   3. Neither set → throw AgentNotConfiguredError → scripted fallback in the UI
 *
 * Provider availability (both local dev and production):
 *   A provider appears in the dropdown only when its VITE_*_API_KEY is present.
 *   - Local dev: set the real key in .env → Vite proxy injects it server-side.
 *   - Production: CI injects each VITE_*_API_KEY from GitHub Secrets at build time
 *     (any non-empty value signals the provider is configured; actual calls go
 *     through the Function which holds the real key as a Firebase secret).
 */

export type AgentProvider = "zai" | "alibaba" | "openrouter";

export interface AgentTurnMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AgentTurnRequest {
  system: string;
  messages: AgentTurnMessage[];
  /** Overrides the configured default provider for this turn. */
  provider?: AgentProvider;
  signal?: AbortSignal;
}

export class AgentNotConfiguredError extends Error {
  constructor() {
    super("No agent endpoint configured");
    this.name = "AgentNotConfiguredError";
  }
}

export class AgentRequestError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "AgentRequestError";
    this.status = status;
  }
}

export class AgentNotImplementedError extends Error {
  provider: AgentProvider;
  constructor(provider: AgentProvider) {
    super(`${provider} is not implemented yet`);
    this.name = "AgentNotImplementedError";
    this.provider = provider;
  }
}

/** Maps each provider to the env var that gates its availability in local dev. */
const PROVIDER_ENV_KEY: Record<AgentProvider, string> = {
  zai: "VITE_ZAI_API_KEY",
  alibaba: "VITE_ALIBABA_API_KEY",
  openrouter: "VITE_OPENROUTER_API_KEY",
};

/** Canonical display order for the provider dropdown. */
export const ALL_PROVIDERS: AgentProvider[] = [
  "zai",
  "alibaba",
  "openrouter",
];

function readEnv(key: string): string | undefined {
  const value = (import.meta.env as Record<string, string | undefined>)[key];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

/** Proxy URL, e.g. "/api/agent" (Hosting rewrite) or a full Function URL. */
export function getAgentEndpoint(): string | undefined {
  return readEnv("VITE_AGENT_ENDPOINT");
}

/** Returns providers that have a VITE_*_API_KEY set — local dev only. */
export function getConfiguredProviders(): AgentProvider[] {
  return ALL_PROVIDERS.filter((p) => Boolean(readEnv(PROVIDER_ENV_KEY[p])));
}

/**
 * Fetches configured providers from the Function (production) or falls back
 * to the synchronous VITE_*_API_KEY check (local dev).
 */
export async function fetchConfiguredProviders(): Promise<AgentProvider[]> {
  const endpoint = getAgentEndpoint();
  if (!endpoint) {
    return getConfiguredProviders();
  }
  try {
    const response = await fetch(endpoint, { method: "GET" });
    if (!response.ok) return [];
    const data = (await response.json()) as { providers?: string[] };
    return (data.providers ?? []).filter((p): p is AgentProvider =>
      ALL_PROVIDERS.includes(p as AgentProvider),
    );
  } catch {
    return [];
  }
}

export function getDefaultProvider(): AgentProvider {
  const configured = readEnv("VITE_AGENT_PROVIDER");
  if (configured && ALL_PROVIDERS.includes(configured as AgentProvider)) {
    return configured as AgentProvider;
  }
  const providers = getConfiguredProviders();
  return providers.length > 0 ? providers[0] : "zai";
}

export function isAgentConfigured(): boolean {
  return Boolean(getAgentEndpoint()) || getConfiguredProviders().length > 0;
}

/**
 * Call Z.ai via the Vite dev proxy (/api/zai → api.z.ai/api/paas/v4).
 * Z.ai uses an OpenAI-compatible chat completions format.
 */
async function sendViaZaiDevProxy(request: AgentTurnRequest): Promise<string> {
  let response: Response;
  try {
    response = await fetch("/api/zai/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: readEnv("VITE_ZAI_MODEL") ?? "glm-4.5-flash",
        max_tokens: 700,
        messages: [
          { role: "system", content: request.system },
          ...request.messages,
        ],
      }),
      signal: request.signal,
    });
  } catch (error) {
    throw new AgentRequestError(
      error instanceof Error ? error.message : "Network error contacting Z.ai",
    );
  }

  if (!response.ok) {
    let detail = `Z.ai request failed (${response.status})`;
    try {
      const body = (await response.json()) as { error?: { message?: string } };
      if (body?.error?.message) detail = body.error.message;
    } catch { /* non-JSON body */ }
    throw new AgentRequestError(detail, response.status);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string | null; reasoning_content?: string } }[];
  };
  const msg = data.choices?.[0]?.message;
  // GLM thinking models may return an empty content with the answer in reasoning_content.
  const text = (msg?.content?.trim() || msg?.reasoning_content?.trim()) ?? "";
  if (!text) throw new AgentRequestError("Z.ai returned an empty response");
  return text;
}

/**
 * Call Alibaba Qwen via the Vite dev proxy (/api/qwen → dashscope-intl.aliyuncs.com/compatible-mode/v1).
 * Qwen uses an OpenAI-compatible chat completions format.
 */
async function sendViaQwenDevProxy(request: AgentTurnRequest): Promise<string> {
  let response: Response;
  try {
    response = await fetch("/api/qwen/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: readEnv("VITE_ALIBABA_MODEL") ?? "qwen3.7-flash",
        max_tokens: 700,
        messages: [
          { role: "system", content: request.system },
          ...request.messages,
        ],
      }),
      signal: request.signal,
    });
  } catch (error) {
    throw new AgentRequestError(
      error instanceof Error ? error.message : "Network error contacting Qwen",
    );
  }

  if (!response.ok) {
    let detail = `Qwen request failed (${response.status})`;
    try {
      const body = (await response.json()) as { error?: { message?: string } };
      if (body?.error?.message) detail = body.error.message;
    } catch { /* non-JSON body */ }
    throw new AgentRequestError(detail, response.status);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) throw new AgentRequestError("Qwen returned an empty response");
  return text;
}

/**
 * Call OpenRouter via the Vite dev proxy (/api/openrouter → openrouter.ai/api/v1).
 * OpenRouter is OpenAI-compatible and routes to any underlying model.
 */
async function sendViaOpenRouterDevProxy(request: AgentTurnRequest): Promise<string> {
  let response: Response;
  try {
    response = await fetch("/api/openrouter/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: readEnv("VITE_OPENROUTER_MODEL") ?? "deepseek/deepseek-r1",
        max_tokens: 700,
        messages: [
          { role: "system", content: request.system },
          ...request.messages,
        ],
      }),
      signal: request.signal,
    });
  } catch (error) {
    throw new AgentRequestError(
      error instanceof Error ? error.message : "Network error contacting OpenRouter",
    );
  }

  if (!response.ok) {
    let detail = `OpenRouter request failed (${response.status})`;
    try {
      const body = (await response.json()) as { error?: { message?: string } };
      if (body?.error?.message) detail = body.error.message;
    } catch { /* non-JSON body */ }
    throw new AgentRequestError(detail, response.status);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string | null; reasoning_content?: string } }[];
  };
  // Some reasoning models return content: null with reasoning_content populated first.
  const msg = data.choices?.[0]?.message;
  const text = (msg?.content ?? msg?.reasoning_content ?? "").trim();
  if (!text) throw new AgentRequestError("OpenRouter returned an empty response");
  return text;
}

/** Send one conversation turn and return the reply text. */
export async function sendAgentTurn(request: AgentTurnRequest): Promise<string> {
  const endpoint = getAgentEndpoint();
  const provider = request.provider ?? getDefaultProvider();

  // Production path: route through the serverless Function proxy.
  if (endpoint) {
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          system: request.system,
          messages: request.messages,
        }),
        signal: request.signal,
      });
    } catch (error) {
      throw new AgentRequestError(
        error instanceof Error ? error.message : "Network error contacting the agent",
      );
    }

    if (!response.ok) {
      let detail = `Agent request failed (${response.status})`;
      try {
        const body = (await response.json()) as { error?: string };
        if (body?.error) detail = body.error;
      } catch { /* non-JSON error body */ }
      throw new AgentRequestError(detail, response.status);
    }

    const data = (await response.json()) as { content?: string };
    if (!data.content) throw new AgentRequestError("Agent returned an empty response");
    return data.content;
  }

  // Local dev path: call the provider directly using its VITE_*_API_KEY.
  if (!readEnv(PROVIDER_ENV_KEY[provider])) {
    throw new AgentNotConfiguredError();
  }

  if (provider === "zai") {
    return sendViaZaiDevProxy(request);
  }

  if (provider === "alibaba") {
    return sendViaQwenDevProxy(request);
  }

  if (provider === "openrouter") {
    return sendViaOpenRouterDevProxy(request);
  }

  // Other providers are not yet implemented for local dev direct calls.
  throw new AgentNotImplementedError(provider);
}
