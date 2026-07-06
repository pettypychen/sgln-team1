import { FormEvent, useMemo, useState } from "react";
import type { ChatMessage, ModuleWorkspace } from "@/types";

interface AgentChatPanelProps {
  module: ModuleWorkspace;
  messages: ChatMessage[];
  onMessagesChange: (messages: ChatMessage[]) => void;
}

function buildAgentResponse(question: string, moduleTitle: string) {
  const normalized = question.toLowerCase();

  if (normalized.includes("fail") || normalized.includes("timeout")) {
    throw new Error("Simulated agent failure");
  }

  if (normalized.includes("risk") || normalized.includes("issue")) {
    return "Start with approval and closing gates: OCC and state-bank approvals, shareholder vote mechanics, capital and acceptable-asset support, consideration mechanics, broad liability assumption, trust department exposure, and the blank outside date. For each issue, tie the next step to a specific document, confirmation, or specialist review.";
  }

  if (normalized.includes("memo") || normalized.includes("draft")) {
    return "A strong associate summary should state that the agreement is not ready for signature, name the top three gating workstreams, and keep cleanup points separate from items that affect regulatory approval, shareholder approval, or closing.";
  }

  return `For ${moduleTitle}, anchor your answer in the case PDF first. I would scan the packet for source evidence, then frame the response by closing impact, evidence strength, and recommended follow-up.`;
}

/** Supporting AI panel for case-context questions. */
export function AgentChatPanel({
  module,
  messages,
  onMessagesChange,
}: AgentChatPanelProps) {
  const [draft, setDraft] = useState("");

  const canSend = draft.trim().length > 0;
  const lastFailedMessage = useMemo(
    () => [...messages].reverse().find((message) => message.status === "failed"),
    [messages],
  );

  function askAgent(
    question: string,
    baseMessages: ChatMessage[],
    failedMessageId?: string,
  ) {
    const responseId = failedMessageId ?? window.crypto.randomUUID();
    const loadingMessage: ChatMessage = {
      id: responseId,
      role: "agent",
      content: "Reviewing the case PDF context...",
      status: "loading",
    };

    const messagesWithLoading = failedMessageId
      ? baseMessages.map((message) =>
          message.id === failedMessageId ? loadingMessage : message,
        )
      : [...baseMessages, loadingMessage];

    onMessagesChange(messagesWithLoading);

    window.setTimeout(() => {
      try {
        const response = buildAgentResponse(question, module.title);
        onMessagesChange(
          messagesWithLoading.map((message) =>
            message.id === responseId
              ? { ...message, content: response, status: "sent" }
              : message,
          ),
        );
      } catch {
        onMessagesChange(
          messagesWithLoading.map((message) =>
            message.id === responseId
              ? {
                  ...message,
                  content:
                    "The agent response failed. Your module progress is unaffected.",
                  status: "failed",
                }
              : message,
          ),
        );
      }
    }, 620);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = draft.trim();
    if (!question) {
      return;
    }

    const userMessage: ChatMessage = {
      id: window.crypto.randomUUID(),
      role: "user",
      content: question,
      status: "sent",
    };
    const nextMessages = [...messages, userMessage];
    onMessagesChange(nextMessages);
    setDraft("");

    window.setTimeout(() => {
      askAgent(question, nextMessages);
    }, 80);
  }

  return (
    <section className="flex min-h-[420px] flex-col rounded-panel bg-white soft-edge xl:min-h-0">
      <div className="border-b border-hairline px-4 py-3">
        <p className="m-0 text-micro font-medium text-muted">AI agent</p>
        <h2 className="m-0 mt-1 text-label font-semibold text-ink">
          Ask about this case
        </h2>
      </div>

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
            <p className="m-0">{message.content}</p>
            {message.status === "loading" && (
              <p className="m-0 mt-2 font-mono text-micro text-muted">
                Agent is responding
              </p>
            )}
            {message.status === "failed" && (
              <button
                type="button"
                className="mt-3 rounded-button bg-white px-3 py-1.5 text-small font-medium text-ink soft-edge"
                onClick={() =>
                  askAgent(
                    [...messages]
                      .reverse()
                      .find((item) => item.role === "user")?.content ??
                      "Retry the prior case question.",
                    messages,
                    message.id,
                  )
                }
              >
                Retry response
              </button>
            )}
          </div>
        ))}
      </div>

      <form className="border-t border-hairline p-3" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="case-question">
          Ask the AI agent a question
        </label>
        <textarea
          id="case-question"
          className="min-h-24 w-full resize-none rounded-panel border border-hairline bg-cloud px-3 py-3 text-body text-ink outline-none transition-colors focus:border-black"
          placeholder="Ask a case question..."
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-micro text-muted">
            Optional. Progress never depends on chat usage.
          </span>
          <button
            type="submit"
            className="rounded-button bg-black px-4 py-2 text-label font-medium text-white transition-colors hover:bg-graphite disabled:cursor-not-allowed disabled:bg-slate-mid"
            disabled={!canSend}
          >
            Send
          </button>
        </div>
      </form>

      {lastFailedMessage && (
        <div className="border-t border-hairline bg-manila px-4 py-2 text-micro text-muted-deep">
          A failed AI response is retryable and does not block advancement.
        </div>
      )}
    </section>
  );
}
