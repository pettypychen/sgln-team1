import { useMemo } from "react";
import type { ChatMessage, ModuleWorkspace, WorkProductDraft } from "@/types";
import { CaseChatPanel } from "@/components/chat/CaseChatPanel";
import { CaseSubmissionPanel } from "@/components/simulation/CaseSubmissionPanel";
import { buildSystemPrompt } from "./caseRubric";
import { GuidedNotesEditor } from "./GuidedNotesEditor";
import type { WorkProductReadiness } from "./workProductReadiness";

interface AgentCasePanelProps {
  module: ModuleWorkspace;
  messages: ChatMessage[];
  workProduct: WorkProductDraft;
  readiness: WorkProductReadiness;
  onMessagesChange: (messages: ChatMessage[]) => void;
  onWorkProductChange: (draft: WorkProductDraft) => void;
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

/** Shared workspace surface: AI chat assists, submission draft is evaluated. */
export function AgentCasePanel({
  module,
  messages,
  workProduct,
  readiness,
  onMessagesChange,
  onWorkProductChange,
  onSubmitForEvaluation,
}: AgentCasePanelProps) {
  const systemPrompt = useMemo(() => buildSystemPrompt(module), [module]);
  const readinessItems = [
    {
      label: readiness.issueLog.label,
      ready: readiness.issueLog.ready,
      detail: readiness.issueLog.countLabel,
    },
    {
      label: readiness.requestList.label,
      ready: readiness.requestList.ready,
      detail: readiness.requestList.countLabel,
    },
    {
      label: readiness.associateSummary.label,
      ready: readiness.associateSummary.ready,
      detail: readiness.associateSummary.countLabel,
    },
  ];

  return (
    <section className="flex min-h-[680px] min-w-0 flex-col overflow-hidden rounded-panel bg-[#fbfaf7] soft-edge lg:h-full lg:min-h-0">
      <div className="border-b border-hairline px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="m-0 text-micro font-medium text-muted">AI agent</p>
            <h2 className="m-0 mt-0.5 text-label font-semibold text-ink">
              Work the case
            </h2>
          </div>
          <span
            className={
              "rounded-button px-2.5 py-1 text-micro font-medium " +
              (readiness.allReady
                ? "bg-teal text-white"
                : "bg-manila text-muted-deep warm-lift")
            }
          >
            {readiness.readyCount}/3 ready
          </span>
        </div>

        <p className="m-0 mt-1.5 text-micro text-muted-deep">
          Use the agent to pressure-test your reasoning, then write the
          submission evaluators will review.
        </p>
      </div>

      <CaseChatPanel
        messages={messages}
        onMessagesChange={onMessagesChange}
        systemPrompt={systemPrompt}
        scriptedFallback={(question) => buildScriptedResponse(question, module.title)}
        starterChips={STARTER_CHIPS}
        placeholder="Ask a source-grounded question about the packet…"
        loadingLiveLabel="Thinking through the packet…"
        loadingScriptedLabel="Reviewing the case…"
        formatMessageContent={(message, { live, agentLabel }) =>
          message.id === "agent-welcome" && live
            ? `Connected to ${agentLabel}. I can challenge your analysis, help you spot gaps, and structure your diligence response. What would you like to work on first?`
            : message.content
        }
        className="flex min-h-[260px] flex-[0.45] flex-col px-4 pb-3"
        transcriptClassName="min-h-0 flex-1 space-y-3 overflow-y-auto py-4"
      />

      <CaseSubmissionPanel
        title="Your submission"
        description="Draft the issue log, request list, and associate summary here. This work product is what moves into final submission."
        readinessItems={readinessItems}
        className="mx-4 mb-3 flex min-h-[340px] flex-1 flex-col overflow-hidden"
      >
        <div className="min-h-0 flex-1">
          <GuidedNotesEditor
            draft={workProduct}
            onDraftChange={onWorkProductChange}
          />
        </div>
      </CaseSubmissionPanel>

      <div className="flex items-center justify-between gap-2 border-t border-hairline bg-[#fbfaf7] px-4 py-3">
        <span className="text-micro text-muted" aria-live="polite">
          {readiness.allReady
            ? "Submission ready to review."
            : `${readiness.readyCount}/3 submission sections ready`}
        </span>
        <button
          type="button"
          className="rounded-button bg-black px-4 py-2 text-small font-medium text-white transition-colors hover:bg-graphite disabled:cursor-not-allowed disabled:opacity-40"
          onClick={onSubmitForEvaluation}
          disabled={!readiness.allReady}
        >
          Review and submit
        </button>
      </div>
    </section>
  );
}
