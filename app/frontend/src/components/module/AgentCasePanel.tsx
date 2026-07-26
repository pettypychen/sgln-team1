import { FormEvent, useMemo, useRef, useState } from "react";
import type { ChatMessage, ModuleWorkspace } from "@/types";
import {
  AgentNotConfiguredError,
  AgentNotImplementedError,
  getConfiguredProviders,
  getDefaultProvider,
  sendAgentTurn,
  type AgentProvider,
  type AgentTurnMessage,
} from "@/lib/agentClient";

const PROVIDER_LABEL: Record<AgentProvider, string> = {
  anthropic: "Anthropic Claude",
  openai: "OpenAI",
  gemini: "Google Gemini",
  zai: "Z.ai",
  alibaba: "Alibaba Qwen",
  openrouter: "OpenRouter",
};
import { buildSystemPrompt } from "./caseRubric";
import type {
  ConversationCoverage,
  CoverageDimension,
} from "./conversationCoverage";

interface AgentCasePanelProps {
  module: ModuleWorkspace;
  messages: ChatMessage[];
  coverage: ConversationCoverage;
  onMessagesChange: (messages: ChatMessage[]) => void;
  onSubmitForEvaluation: () => void;
}

/** Collaborative openers — sent as the learner's turn to start a workstream. */
const STARTER_CHIPS = [
  "Let's work through the approval and shareholder issues.",
  "Pressure-test my diligence request list with me.",
  "Here's my readiness call — push back on it.",
];

/**
 * Scripted fallback used when no live agent endpoint is configured, so the
 * simulation stays fully usable in local dev and demos. Mirrors the Socratic
 * coaching tone of the real system prompt.
 */
function buildScriptedResponse(question: string, moduleTitle: string): string {
  const normalized = question.toLowerCase();

  if (normalized.includes("approval") || normalized.includes("shareholder")) {
    return "Good place to start. Rivergate needs OCC approval and a merger certificate, plus a shareholder vote — check the required threshold and the blank record date. Which of those is a hard gate to closing, and what would you request to confirm the vote mechanics?";
  }
  if (normalized.includes("request") || normalized.includes("confirmation")) {
    return "Group them by category: corporate authority, regulatory and shareholder approvals, financial/capital/consideration, and liabilities/operations. Pick your weakest category — name two documents or confirmations you'd ask for there, and who they'd route to.";
  }
  if (normalized.includes("readiness") || normalized.includes("summary") || normalized.includes("sign")) {
    return "Then commit: is the agreement ready for signature, yes or no? Name your top three gating workstreams and the first one you'd staff. Where do you need a specialist — regulatory counsel, tax, or the trust department?";
  }
  if (normalized.includes("risk") || normalized.includes("issue")) {
    return "Which of these is actually gating versus drafting cleanup? Separate the blank outside date and execution blocks from the approval, capital-support, and liability-assumption risks. Tie each gating issue to a specific next step.";
  }
  return `For ${moduleTitle}, anchor your reasoning in the packet. Point me to the clause or blank that concerns you, tell me why it matters to signing or closing, and what you'd do about it. What's the first issue you want to work?`;
}

/** Map stored chat history into the provider-agnostic turn format. */
function toTurnMessages(messages: ChatMessage[]): AgentTurnMessage[] {
  return messages
    .filter((message) => message.status === "sent")
    .map((message) => ({
      role: message.role === "user" ? "user" : "assistant",
      content: message.content,
    }));
}

function coverageDotClass(dimension: CoverageDimension): string {
  if (dimension.ready) {
    return "bg-teal";
  }
  return dimension.count > 0 ? "bg-amber" : "bg-silver";
}

/** AI-native case surface: the learner answers the case by reasoning here. */
export function AgentCasePanel({
  module,
  messages,
  coverage,
  onMessagesChange,
  onSubmitForEvaluation,
}: AgentCasePanelProps) {
  const [draft, setDraft] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const providerOptions = getConfiguredProviders();
  const live = providerOptions.length > 0;
  const [selectedProvider, setSelectedProvider] = useState<AgentProvider>(
    () => providerOptions[0] ?? getDefaultProvider(),
  );
  const agentLabel = live ? PROVIDER_LABEL[selectedProvider] : "Agent";

  const canSend = draft.trim().length > 0 && !isThinking;
  const systemPrompt = useMemo(() => buildSystemPrompt(module), [module]);

  const dimensions: CoverageDimension[] = [
    coverage.issueLog,
    coverage.requestList,
    coverage.associateSummary,
  ];

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
      window.setTimeout(
        () => finish(buildScriptedResponse(question, module.title), "sent"),
        620,
      );
      return;
    }

    sendAgentTurn({ system: systemPrompt, messages: toTurnMessages(history), provider: selectedProvider })
      .then((content) => finish(content, "sent"))
      .catch((error) => {
        if (error instanceof AgentNotConfiguredError) {
          finish(buildScriptedResponse(question, module.title), "sent");
          return;
        }
        if (error instanceof AgentNotImplementedError) {
          finish("AI model not implemented yet.", "failed");
          return;
        }
        console.error("[AgentCasePanel] request failed:", error);
        finish(
          "The agent response failed. Your case progress is safe — retry when ready.",
          "failed",
        );
      });
  }

  function sendMessage(question: string, retryId?: string) {
    const trimmed = question.trim();
    if (!trimmed) {
      return;
    }

    const responseId = retryId ?? window.crypto.randomUUID();
    const loadingMessage: ChatMessage = {
      id: responseId,
      role: "agent",
      content: live ? "Thinking through the packet..." : "Reviewing the case...",
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
    const historyForModel = history.filter((message) => message.id !== responseId);
    resolveResponse(trimmed, historyForModel, responseId);
  }

  function lastLearnerQuestion(): string {
    return (
      [...messages].reverse().find((message) => message.role === "user")
        ?.content ?? "Continue coaching me on the case."
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendMessage(draft);
  }

  return (
    <section className="flex min-h-[680px] min-w-0 flex-col overflow-hidden rounded-panel bg-white soft-edge lg:h-full lg:min-h-0">
      {/* Header + live coverage dashboard */}
      <div className="border-b border-hairline px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="m-0 text-micro font-medium text-muted">AI agent</p>
            <h2 className="m-0 mt-0.5 text-label font-semibold text-ink">
              Work the case in conversation
            </h2>
          </div>
          <span
            className={
              "rounded-button px-2.5 py-1 text-micro font-medium " +
              (coverage.allReady
                ? "bg-teal text-white"
                : "bg-manila text-muted-deep warm-lift")
            }
          >
            {coverage.readyCount}/3 ready
          </span>
        </div>

        <p className="m-0 mt-1.5 text-micro text-muted-deep">
          Reason through the packet with the agent. Your dialogue is the
          deliverable — the tracker fills as you cover each workstream.
          {live ? null : " (Demo mode: scripted agent until a live model is connected.)"}
        </p>

        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {dimensions.map((dimension) => (
            <div
              key={dimension.id}
              className="rounded-button bg-cloud px-2.5 py-2"
              title={dimension.message}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className={
                    "h-1.5 w-1.5 shrink-0 rounded-button " +
                    coverageDotClass(dimension)
                  }
                  aria-hidden="true"
                />
                <span className="truncate text-micro font-medium text-muted-deep">
                  {dimension.label}
                </span>
              </div>
              <p className="m-0 mt-1 font-mono text-micro text-muted-deep">
                {dimension.count}/{dimension.target}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Collaborative openers */}
      <div className="border-b border-hairline bg-manila/60 px-4 py-2.5">
        <div className="flex flex-wrap gap-2">
          {STARTER_CHIPS.map((chip) => (
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

      {/* Transcript */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={
              "rounded-panel p-3 text-small " +
              (message.role === "user"
                ? "ml-8 bg-black text-white"
                : "mr-8 bg-cloud text-muted-deep")
            }
          >
            <p className="m-0 whitespace-pre-wrap">
              {message.id === "agent-welcome" && live
                ? `Connected to ${agentLabel}. Reason through the case here — I'll challenge your analysis, help you spot gaps, and structure your diligence response. What would you like to work on first?`
                : message.content}
            </p>
            {message.status === "loading" && (
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
        ))}
      </div>

      {/* Composer */}
      <form className="border-t border-hairline p-3" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="case-turn">
          Reason through the case with the agent
        </label>
        <textarea
          id="case-turn"
          className="min-h-20 w-full resize-none rounded-panel border border-hairline bg-cloud px-3 py-3 text-body text-ink outline-none transition-colors focus:border-black"
          placeholder="Make your case — spot an issue, justify a request, or give your readiness call..."
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
                onChange={(e) => setSelectedProvider(e.target.value as AgentProvider)}
                disabled={isThinking}
                className="rounded border border-hairline bg-transparent py-0.5 pl-1.5 pr-6 text-micro text-muted outline-none focus:border-black disabled:opacity-50"
              >
                {providerOptions.map((p) => (
                  <option key={p} value={p}>{PROVIDER_LABEL[p]}</option>
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
            {isThinking ? "Thinking..." : "Send"}
          </button>
        </div>
      </form>

      {/* Sticky evaluation footer */}
      <div className="flex items-center justify-between gap-2 border-t border-hairline bg-[#fbfaf7] px-4 py-3">
        <span className="text-micro text-muted" aria-live="polite">
          {coverage.allReady
            ? "All workstreams covered — ready to evaluate."
            : `${coverage.readyCount}/3 workstreams covered`}
        </span>
        <button
          type="button"
          className="rounded-button bg-black px-4 py-2 text-small font-medium text-white transition-colors hover:bg-graphite"
          onClick={onSubmitForEvaluation}
        >
          Submit for AI grading
        </button>
      </div>
    </section>
  );
}
