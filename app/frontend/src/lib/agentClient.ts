/**
 * Provider-agnostic client for the case agent.
 *
 * Calls a serverless proxy (Firebase Function) that holds the real API keys and
 * dispatches to Anthropic, OpenAI, or Gemini. The proxy contract is a single
 * POST with `{ provider, system, messages }` returning `{ content }`.
 *
 * When no endpoint is configured (local dev, preview, or a demo without keys)
 * the client throws `AgentNotConfiguredError` so callers can fall back to the
 * built-in scripted responses and keep the app fully usable.
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
  return Boolean(getAgentEndpoint());
}

/** Send one conversation turn through the proxy and return the reply text. */
export async function sendAgentTurn(request: AgentTurnRequest): Promise<string> {
  const endpoint = getAgentEndpoint();
  if (!endpoint) {
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
      if (body?.error) {
        detail = body.error;
      }
    } catch {
      /* non-JSON error body — keep the generic message */
    }
    throw new AgentRequestError(detail, response.status);
  }

  const data = (await response.json()) as { content?: string };
  if (!data.content) {
    throw new AgentRequestError("Agent returned an empty response");
  }
  return data.content;
}
