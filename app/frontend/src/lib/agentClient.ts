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

export type AgentProvider = "anthropic" | "zai" | "alibaba" | "openrouter";

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
  /** Called in local dev when a model fails and the next one is about to be tried. */
  onModelSwitch?: (failedModel: string, nextModel: string) => void;
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
  anthropic: "VITE_ANTHROPIC_API_KEY",
  zai: "VITE_ZAI_API_KEY",
  alibaba: "VITE_ALIBABA_API_KEY",
  openrouter: "VITE_OPENROUTER_API_KEY",
};

/** Canonical display order for the provider dropdown. */
export const ALL_PROVIDERS: AgentProvider[] = [
  "anthropic",
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
 * Models to try per provider in round-robin order — mirrors the server-side list.
 * Exhausting all models for a provider causes the outer chain to move to the next provider.
 */
export const PROVIDER_MODELS: Record<AgentProvider, string[]> = {
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
  zai: ["glm-4.5-flash"],
  openrouter: ["deepseek/deepseek-r1"],
  anthropic: ["claude-sonnet-5"],
};

// Per-provider round-robin counters for local dev (module-level, survive HMR).
const providerModelIndex: Record<AgentProvider, number> = {
  alibaba: 0, zai: 0, openrouter: 0, anthropic: 0,
};

// --- Pure HTTP call functions for local dev (accept model, return content string) ---

async function devCallAnthropic(request: AgentTurnRequest, model: string): Promise<string> {
  const response = await fetch("/api/anthropic/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: 700, system: request.system, messages: request.messages }),
    signal: request.signal,
  });
  if (!response.ok) {
    let detail = `Anthropic request failed (${response.status})`;
    try { const b = (await response.json()) as { error?: { message?: string } }; if (b?.error?.message) detail = b.error.message; } catch { /* ok */ }
    throw new AgentRequestError(detail, response.status);
  }
  const data = (await response.json()) as { content?: { type: string; text?: string }[] };
  const text = data.content?.find((b) => b.type === "text")?.text?.trim() ?? "";
  if (!text) throw new AgentRequestError("Anthropic returned an empty response");
  return text;
}

async function devCallZai(request: AgentTurnRequest, model: string): Promise<string> {
  const response = await fetch("/api/zai/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: 700, messages: [{ role: "system", content: request.system }, ...request.messages] }),
    signal: request.signal,
  });
  if (!response.ok) {
    let detail = `Z.ai request failed (${response.status})`;
    try { const b = (await response.json()) as { error?: { message?: string } }; if (b?.error?.message) detail = b.error.message; } catch { /* ok */ }
    throw new AgentRequestError(detail, response.status);
  }
  const data = (await response.json()) as { choices?: { message?: { content?: string | null; reasoning_content?: string } }[] };
  const msg = data.choices?.[0]?.message;
  const text = (msg?.content?.trim() || msg?.reasoning_content?.trim()) ?? "";
  if (!text) throw new AgentRequestError("Z.ai returned an empty response");
  return text;
}

async function devCallAlibaba(request: AgentTurnRequest, model: string): Promise<string> {
  const response = await fetch("/api/qwen/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: 700, messages: [{ role: "system", content: request.system }, ...request.messages] }),
    signal: request.signal,
  });
  if (!response.ok) {
    let detail = `Qwen request failed (${response.status})`;
    try { const b = (await response.json()) as { error?: { message?: string } }; if (b?.error?.message) detail = b.error.message; } catch { /* ok */ }
    throw new AgentRequestError(detail, response.status);
  }
  const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) throw new AgentRequestError("Qwen returned an empty response");
  return text;
}

async function devCallOpenRouter(request: AgentTurnRequest, model: string): Promise<string> {
  const response = await fetch("/api/openrouter/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: 700, messages: [{ role: "system", content: request.system }, ...request.messages] }),
    signal: request.signal,
  });
  if (!response.ok) {
    let detail = `OpenRouter request failed (${response.status})`;
    try { const b = (await response.json()) as { error?: { message?: string } }; if (b?.error?.message) detail = b.error.message; } catch { /* ok */ }
    throw new AgentRequestError(detail, response.status);
  }
  const data = (await response.json()) as { choices?: { message?: { content?: string | null; reasoning_content?: string } }[] };
  const msg = data.choices?.[0]?.message;
  const text = (msg?.content ?? msg?.reasoning_content ?? "").trim();
  if (!text) throw new AgentRequestError("OpenRouter returned an empty response");
  return text;
}

const DEV_HTTP_CALL: Record<AgentProvider, (req: AgentTurnRequest, model: string) => Promise<string>> = {
  anthropic: devCallAnthropic,
  zai: devCallZai,
  alibaba: devCallAlibaba,
  openrouter: devCallOpenRouter,
};

/** Automatic provider fallback order used by the chat panel. */
export const PROVIDER_FALLBACK_CHAIN: AgentProvider[] = [
  "alibaba",
  "zai",
  "openrouter",
  "anthropic",
];

/**
 * Send a turn trying providers in PROVIDER_FALLBACK_CHAIN order. For each provider
 * all its models are exhausted before moving to the next provider.
 * Calls onProviderSwitch(provider, attemptIndex) before each provider try so the UI
 * can update mid-flight. Returns { content, provider, model } on first success.
 */
export async function sendAgentTurnWithFallback(
  request: Omit<AgentTurnRequest, "provider" | "onModelSwitch">,
  onProviderSwitch: (provider: AgentProvider, attempt: number) => void,
  onModelSwitch?: (provider: AgentProvider, failedModel: string, nextModel: string) => void,
): Promise<{ content: string; provider: AgentProvider; model?: string }> {
  const endpoint = getAgentEndpoint();
  const chain = endpoint
    ? PROVIDER_FALLBACK_CHAIN
    : PROVIDER_FALLBACK_CHAIN.filter((p) => Boolean(readEnv(PROVIDER_ENV_KEY[p])));

  if (chain.length === 0) throw new AgentNotConfiguredError();

  let lastError: unknown;
  for (let i = 0; i < chain.length; i++) {
    const provider = chain[i];
    onProviderSwitch(provider, i);
    try {
      const { content, model } = await sendAgentTurn({
        ...request,
        provider,
        onModelSwitch: onModelSwitch
          ? (failed, next) => onModelSwitch(provider, failed, next)
          : undefined,
      });
      return { content, provider, model };
    } catch (err) {
      lastError = err;
      if (err instanceof AgentNotConfiguredError) continue;
    }
  }

  throw lastError ?? new AgentRequestError("All AI providers failed.");
}

/**
 * Send one turn for the given provider, exhausting all its models before throwing.
 * Production: one HTTP call to the Cloud Function (model loop runs server-side).
 * Local dev: loops through PROVIDER_MODELS[provider] here in the browser.
 */
export async function sendAgentTurn(request: AgentTurnRequest): Promise<{ content: string; model?: string }> {
  const endpoint = getAgentEndpoint();
  const provider = request.provider ?? getDefaultProvider();

  // Production: Cloud Function handles model loop and returns { content, model }.
  if (endpoint) {
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, system: request.system, messages: request.messages }),
        signal: request.signal,
      });
    } catch (error) {
      throw new AgentRequestError(
        error instanceof Error ? error.message : "Network error contacting the agent",
      );
    }
    if (!response.ok) {
      let detail = `Agent request failed (${response.status})`;
      try { const b = (await response.json()) as { error?: string }; if (b?.error) detail = b.error; } catch { /* ok */ }
      throw new AgentRequestError(detail, response.status);
    }
    const data = (await response.json()) as { content?: string; model?: string };
    if (!data.content) throw new AgentRequestError("Agent returned an empty response");
    return { content: data.content, model: data.model };
  }

  // Local dev: call provider API directly, loop through all its models.
  if (!readEnv(PROVIDER_ENV_KEY[provider])) throw new AgentNotConfiguredError();

  const models = PROVIDER_MODELS[provider];
  const startIdx = providerModelIndex[provider];
  let lastError: unknown;
  for (let i = 0; i < models.length; i++) {
    const idx = (startIdx + i) % models.length;
    const model = models[idx];
    try {
      const content = await DEV_HTTP_CALL[provider](request, model);
      // Success: keep index at this model for next request.
      return { content, model };
    } catch (err) {
      lastError = err;
      // Only advance on failure.
      providerModelIndex[provider] = (idx + 1) % models.length;
      // Notify the UI if there's another model to try.
      if (i < models.length - 1) {
        const nextModel = models[(idx + 1) % models.length];
        request.onModelSwitch?.(model, nextModel);
      }
    }
  }
  throw lastError ?? new AgentRequestError(`All ${provider} models failed.`);
}
