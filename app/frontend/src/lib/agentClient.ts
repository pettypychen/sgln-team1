/**
 * Provider-agnostic client for the case agent.
 *
 * Priority order:
 *   1. VITE_AGENT_ENDPOINT set → call the serverless proxy (production / staging)
 *   2. VITE_ANTHROPIC_API_KEY set → call Anthropic directly (local dev shortcut)
 *   3. Neither set → throw AgentNotConfiguredError → scripted fallback in the UI
 *
 * The direct key path is intentionally local-dev only: .env is gitignored so
 * the key never gets committed or shipped in a production build.
 */

export type AgentProvider = "anthropic" | "openai" | "gemini";

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

function readEnv(key: string): string | undefined {
  const value = (import.meta.env as Record<string, string | undefined>)[key];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

/** Proxy URL, e.g. "/api/agent" (Hosting rewrite) or a full Function URL. */
export function getAgentEndpoint(): string | undefined {
  return readEnv("VITE_AGENT_ENDPOINT");
}

export function getDefaultProvider(): AgentProvider {
  const configured = readEnv("VITE_AGENT_PROVIDER");
  if (configured === "openai" || configured === "gemini" || configured === "anthropic") {
    return configured;
  }
  return "anthropic";
}

export function isAgentConfigured(): boolean {
  return Boolean(getAgentEndpoint()) || Boolean(readEnv("VITE_ANTHROPIC_API_KEY"));
}

/**
 * Call Anthropic via the Vite dev proxy (/api/anthropic → api.anthropic.com).
 * The proxy injects the API key server-side so it never appears in browser
 * network requests and there are no CORS issues.
 */
async function sendViaDevProxy(request: AgentTurnRequest): Promise<string> {
  let response: Response;
  try {
    response = await fetch("/api/anthropic/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 700,
        system: request.system,
        messages: request.messages,
      }),
      signal: request.signal,
    });
  } catch (error) {
    throw new AgentRequestError(
      error instanceof Error ? error.message : "Network error contacting Anthropic",
    );
  }

  if (!response.ok) {
    let detail = `Anthropic request failed (${response.status})`;
    try {
      const body = (await response.json()) as { error?: { message?: string } };
      if (body?.error?.message) detail = body.error.message;
    } catch { /* non-JSON body */ }
    throw new AgentRequestError(detail, response.status);
  }

  const data = (await response.json()) as { content?: { type: string; text: string }[] };
  const text = (data.content ?? [])
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  if (!text) throw new AgentRequestError("Anthropic returned an empty response");
  return text;
}

/** Send one conversation turn and return the reply text. */
export async function sendAgentTurn(request: AgentTurnRequest): Promise<string> {
  const endpoint = getAgentEndpoint();

  // Local dev shortcut: call Anthropic directly if no proxy is configured
  if (!endpoint) {
    if (readEnv("VITE_ANTHROPIC_API_KEY")) {
      return sendViaDevProxy(request);
    }
    throw new AgentNotConfiguredError();
  }

  const provider = request.provider ?? getDefaultProvider();

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
