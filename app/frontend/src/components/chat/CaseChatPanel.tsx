import {
  FormEvent,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ChatMessage } from "@/types";
import {
  AgentNotConfiguredError,
  AgentNotImplementedError,
  fetchConfiguredProviders,
  getAgentEndpoint,
  getConfiguredProviders,
  getDefaultProvider,
  sendAgentTurn,
  type AgentProvider,
  type AgentTurnMessage,
} from "@/lib/agentClient";
import { MarkdownDocument } from "@/components/ui/MarkdownDocument";

const PROVIDER_LABEL: Record<AgentProvider, string> = {
  anthropic: "Anthropic Claude",
  openai: "OpenAI",
  gemini: "Google Gemini",
  zai: "Z.ai",
  alibaba: "Alibaba Qwen",
  openrouter: "OpenRouter",
};

export interface CaseChatPanelProps {
  /** Controlled transcript. Owns the source of truth for the conversation. */
  messages: ChatMessage[];
  /** Emits the full next transcript whenever a turn is added or resolved. */
  onMessagesChange: (messages: ChatMessage[]) => void;
  /** System prompt sent with every live turn. */
  systemPrompt: string;
  /** Reply used when no live agent is configured (demo/local dev). */
  scriptedFallback: (question: string) => string;
  /** Optional one-click openers rendered above the transcript. */
  starterChips?: string[];
  placeholder?: string;
  /** Rendered inside the transcript area when there are no messages. */
  emptyState?: ReactNode;
  /**
   * Optional override for a message's displayed text — e.g. a welcome message
   * that adapts to the connected provider. Defaults to the raw content.
   */
  formatMessageContent?: (
    message: ChatMessage,
    context: { live: boolean; agentLabel: string },
  ) => string;
  loadingLiveLabel?: string;
  loadingScriptedLabel?: string;
  /** Container class for the whole panel (transcript + composer). */
  className?: string;
  /** Class for the scrollable transcript region. */
  transcriptClassName?: string;
}

/** Map the transcript into the provider-agnostic turn format. */
function toTurnMessages(messages: ChatMessage[]): AgentTurnMessage[] {
  return messages
    .filter((message) => message.status === "sent")
    .map((message) => ({
      role: message.role === "user" ? "user" : "assistant",
      content: message.content,
    }));
}

/**
 * Shared conversational case surface: a provider-aware transcript and composer
 * used by every case (prototype cases and the M&A module workspace). Callers
 * own the transcript state and supply the system prompt + scripted fallback;
 * this component owns the send orchestration and the chat UI.
 */
export function CaseChatPanel({
  messages,
  onMessagesChange,
  systemPrompt,
  scriptedFallback,
  starterChips,
  placeholder = "Ask a source-grounded question…",
  emptyState,
  formatMessageContent,
  loadingLiveLabel = "Thinking…",
  loadingScriptedLabel = "Reviewing the case…",
  className = "flex min-h-0 flex-1 flex-col",
  transcriptClassName = "min-h-0 flex-1 space-y-3 overflow-y-auto py-4",
}: CaseChatPanelProps) {
  const [draft, setDraft] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // In production (VITE_AGENT_ENDPOINT set), providers are fetched from the
  // Function on mount. In local dev they're resolved synchronously from VITE_*_API_KEY.
  const initialProviders = getAgentEndpoint() ? [] : getConfiguredProviders();
  const [providerOptions, setProviderOptions] =
    useState<AgentProvider[]>(initialProviders);
  const [providersLoading, setProvidersLoading] = useState(() =>
    Boolean(getAgentEndpoint()),
  );
  const [selectedProvider, setSelectedProvider] = useState<AgentProvider>(
    () => initialProviders[0] ?? getDefaultProvider(),
  );

  useEffect(() => {
    if (!getAgentEndpoint()) return;
    fetchConfiguredProviders().then((providers) => {
      setProviderOptions(providers);
      if (providers.length > 0) setSelectedProvider(providers[0]);
      setProvidersLoading(false);
    });
  }, []);

  const live = providerOptions.length > 0;
  const agentLabel = providersLoading
    ? "Loading…"
    : live
      ? PROVIDER_LABEL[selectedProvider]
      : "Agent";
  const canSend = draft.trim().length > 0 && !isThinking;

  function resolveResponse(
    question: string,
    history: ChatMessage[],
    responseId: string,
  ) {
    const finish = (content: string, status: ChatMessage["status"]) => {
      const latest = messagesRef.current;
      onMessagesChange(
        latest.map((message) =>
          message.id === responseId ? { ...message, content, status } : message,
        ),
      );
      setIsThinking(false);
    };

    if (!live) {
      // Scripted fallback keeps the case playable without a backend.
      window.setTimeout(() => finish(scriptedFallback(question), "sent"), 620);
      return;
    }

    sendAgentTurn({
      system: systemPrompt,
      messages: toTurnMessages(history),
      provider: selectedProvider,
    })
      .then((content) => finish(content, "sent"))
      .catch((error) => {
        if (error instanceof AgentNotConfiguredError) {
          finish(scriptedFallback(question), "sent");
          return;
        }
        if (error instanceof AgentNotImplementedError) {
          finish("AI model not implemented yet.", "failed");
          return;
        }
        console.error("[CaseChatPanel] request failed:", error);
        finish(
          "The agent response failed. Your progress is safe — retry when ready.",
          "failed",
        );
      });
  }

  function sendMessage(question: string, retryId?: string) {
    const trimmed = question.trim();
    if (!trimmed || (isThinking && !retryId)) {
      return;
    }

    const responseId = retryId ?? window.crypto.randomUUID();
    const loadingMessage: ChatMessage = {
      id: responseId,
      role: "agent",
      content: live ? loadingLiveLabel : loadingScriptedLabel,
      status: "loading",
    };

    let history: ChatMessage[];
    if (retryId) {
      // Replace the failed reply in place; history already holds the question.
      history = messages.map((message) =>
        message.id === retryId ? loadingMessage : message,
      );
    } else {
      const userMessage: ChatMessage = {
        id: window.crypto.randomUUID(),
        role: "user",
        content: trimmed,
        status: "sent",
      };
      history = [...messages, userMessage, loadingMessage];
    }

    onMessagesChange(history);
    setDraft("");
    setIsThinking(true);

    // The turn we send the model excludes the loading placeholder.
    const historyForModel = history.filter(
      (message) => message.id !== responseId,
    );
    resolveResponse(trimmed, historyForModel, responseId);
  }

  function lastLearnerQuestion(): string {
    return (
      [...messagesRef.current].reverse().find((message) => message.role === "user")
        ?.content ?? "Continue coaching me on the case."
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendMessage(draft);
  }

  return (
    <div className={className}>
      {starterChips && starterChips.length > 0 ? (
        <div className="border-b border-hairline bg-manila/60 px-1 py-2.5">
          <div className="flex flex-wrap gap-2">
            {starterChips.map((chip) => (
              <button
                key={chip}
                type="button"
                className="rounded-button bg-white px-3 py-1.5 text-small text-ink soft-edge transition-colors hover:bg-cloud disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => sendMessage(chip)}
                disabled={isThinking}
              >
                {chip}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Transcript */}
      <div className={transcriptClassName} aria-live="polite">
        {messages.map((message) => {
          const content = formatMessageContent
            ? formatMessageContent(message, { live, agentLabel })
            : message.content;
          const isUser = message.role === "user";
          const isLoading = message.status === "loading";
          return (
            <div
              key={message.id}
              className={
                "rounded-panel p-3 text-small " +
                (isUser
                  ? "ml-8 bg-black text-white"
                  : "mr-8 bg-cloud text-muted-deep")
              }
            >
              {isUser || isLoading ? (
                <p className="m-0 whitespace-pre-wrap">{content}</p>
              ) : (
                <MarkdownDocument content={content} compact />
              )}
              {isLoading && (
                <p className="m-0 mt-2 font-mono text-micro text-muted">
                  {live ? `${agentLabel} is responding…` : "Agent is responding"}
                </p>
              )}
              {message.status === "failed" && (
                <button
                  type="button"
                  className="mt-3 rounded-button bg-white px-3 py-1.5 text-small font-medium text-ink soft-edge"
                  onClick={() => sendMessage(lastLearnerQuestion(), message.id)}
                >
                  Retry response
                </button>
              )}
            </div>
          );
        })}
        {messages.length === 0 && emptyState ? emptyState : null}
      </div>

      {/* Composer */}
      <form className="mt-4" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="case-turn">
          Message the case agent
        </label>
        <textarea
          id="case-turn"
          className="min-h-20 w-full resize-none rounded-panel border border-hairline bg-cloud px-3 py-3 text-body text-ink outline-none transition-colors focus:border-black"
          placeholder={placeholder}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              sendMessage(draft);
            }
          }}
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {live ? (
              <select
                value={selectedProvider}
                onChange={(event) =>
                  setSelectedProvider(event.target.value as AgentProvider)
                }
                disabled={isThinking}
                className="rounded border border-hairline bg-transparent py-0.5 pl-1.5 pr-6 text-micro text-muted outline-none focus:border-black disabled:opacity-50"
              >
                {providerOptions.map((provider) => (
                  <option key={provider} value={provider}>
                    {PROVIDER_LABEL[provider]}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-micro text-muted">No AI model configured</span>
            )}
            <span className="text-micro text-muted">· ⌘/Ctrl+Enter to send</span>
          </div>
          <button
            type="submit"
            className="rounded-button bg-black px-4 py-2 text-small font-medium text-white transition-colors hover:bg-graphite disabled:cursor-not-allowed disabled:bg-slate-mid"
            disabled={!canSend}
          >
            {isThinking ? "Thinking…" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
