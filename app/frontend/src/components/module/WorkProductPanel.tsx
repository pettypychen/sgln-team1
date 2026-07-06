import { useEffect, useMemo, useState } from "react";
import type { WorkProductDraft } from "@/types";

type WorkProductTab = "issueLog" | "requestList" | "associateSummary";

interface WorkProductPanelProps {
  draft: WorkProductDraft;
  currentStepId: string;
  onDraftChange: (draft: WorkProductDraft) => void;
}

const TABS: { id: WorkProductTab; label: string }[] = [
  { id: "issueLog", label: "Issue log" },
  { id: "requestList", label: "Requests" },
  { id: "associateSummary", label: "Summary" },
];

function tabForStep(stepId: string): WorkProductTab {
  if (stepId === "draft-requests") {
    return "requestList";
  }

  if (stepId === "final-check") {
    return "associateSummary";
  }

  return "issueLog";
}

function countIssueRows(value: string) {
  return value
    .split("\n")
    .filter((line) => {
      const normalized = line.trim();
      return (
        normalized.startsWith("|") &&
        !normalized.includes("---") &&
        !normalized.toLowerCase().includes("section | issue")
      );
    }).length;
}

function countRequests(value: string) {
  return value
    .split("\n")
    .filter((line) => line.trim().startsWith("- ")).length;
}

function countWords(value: string) {
  const words = value.trim().match(/\S+/g);
  return words?.length ?? 0;
}

function textareaLabel(tab: WorkProductTab) {
  if (tab === "issueLog") {
    return "Diligence issue log";
  }

  if (tab === "requestList") {
    return "Diligence request list";
  }

  return "Associate summary";
}

function placeholderForTab(tab: WorkProductTab) {
  if (tab === "issueLog") {
    return "| Section | Issue | Why It Matters | Risk | Next Step |\n| --- | --- | --- | --- | --- |\n| Preamble |  |  |  |  |";
  }

  if (tab === "requestList") {
    return "## Corporate Authority\n- \n\n## Regulatory and Shareholder Approval\n- \n\n## Financial / Capital / Consideration\n- ";
  }

  return "The agreement is not ready for signature because...";
}

/** Persistent drafting surface for learner work product. */
export function WorkProductPanel({
  draft,
  currentStepId,
  onDraftChange,
}: WorkProductPanelProps) {
  const [activeTab, setActiveTab] = useState<WorkProductTab>(
    tabForStep(currentStepId),
  );

  useEffect(() => {
    setActiveTab(tabForStep(currentStepId));
  }, [currentStepId]);

  const metrics = useMemo(
    () => ({
      issues: countIssueRows(draft.issueLog),
      requests: countRequests(draft.requestList),
      words: countWords(draft.associateSummary),
    }),
    [draft],
  );

  const activeValue = draft[activeTab];

  function updateActiveValue(value: string) {
    onDraftChange({
      ...draft,
      [activeTab]: value,
    });
  }

  function insertIssueRow() {
    const row = "|  |  |  |  |  |";
    onDraftChange({
      ...draft,
      issueLog: draft.issueLog.trimEnd() + "\n" + row,
    });
    setActiveTab("issueLog");
  }

  function insertRequestLine() {
    onDraftChange({
      ...draft,
      requestList: draft.requestList.trimEnd() + "\n- ",
    });
    setActiveTab("requestList");
  }

  const completionSignals = [
    {
      label: "Issues",
      value: `${metrics.issues}/12`,
      complete: metrics.issues >= 12,
    },
    {
      label: "Requests",
      value: `${metrics.requests}/10`,
      complete: metrics.requests >= 10,
    },
    {
      label: "Summary",
      value: `${metrics.words}/350`,
      complete: metrics.words > 0 && metrics.words <= 350,
    },
  ];

  return (
    <section className="flex min-h-[560px] flex-col overflow-hidden rounded-panel bg-white soft-edge">
      <div className="border-b border-hairline px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="m-0 text-micro font-medium text-muted">
              Learner work product
            </p>
            <h2 className="m-0 mt-1 font-display text-[30px] font-light leading-[1.08] text-ink">
              Draft answers
            </h2>
          </div>
          <div className="flex shrink-0 gap-1 rounded-button bg-cloud p-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={
                  "rounded-button px-3 py-1.5 text-small font-medium transition-colors " +
                  (activeTab === tab.id
                    ? "bg-black text-white"
                    : "text-muted-deep hover:bg-white hover:text-ink")
                }
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {completionSignals.map((signal) => (
            <div
              key={signal.label}
              className={
                "rounded-panel border px-3 py-2 " +
                (signal.complete
                  ? "border-black bg-white"
                  : "border-hairline bg-cloud")
              }
            >
              <p className="m-0 text-micro text-muted">{signal.label}</p>
              <p className="m-0 mt-1 font-mono text-small text-ink">
                {signal.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3 border-b border-hairline bg-manila/60 px-4 py-3 sm:grid-cols-2">
        <button
          type="button"
          className="inline-flex min-h-10 items-center justify-center rounded-button bg-white px-4 py-2 text-small font-medium text-ink soft-edge transition-colors hover:bg-cloud"
          onClick={insertIssueRow}
        >
          + Issue row
        </button>
        <button
          type="button"
          className="inline-flex min-h-10 items-center justify-center rounded-button bg-white px-4 py-2 text-small font-medium text-ink soft-edge transition-colors hover:bg-cloud"
          onClick={insertRequestLine}
        >
          + Request
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-4 py-4">
        <label
          className="mb-2 text-small font-semibold text-ink"
          htmlFor="work-product-draft"
        >
          {textareaLabel(activeTab)}
        </label>
        <textarea
          id="work-product-draft"
          className="min-h-[360px] flex-1 resize-none rounded-panel border border-hairline bg-[#fbfbfa] px-3 py-3 font-mono text-small leading-relaxed text-ink outline-none transition-colors placeholder:text-muted focus:border-black"
          placeholder={placeholderForTab(activeTab)}
          value={activeValue}
          onChange={(event) => updateActiveValue(event.target.value)}
          spellCheck
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-micro text-muted-deep">
          <span>Autosaved locally.</span>
          <span>
            {activeTab === "associateSummary"
              ? `${metrics.words} words`
              : activeTab === "issueLog"
                ? `${metrics.issues} issue rows`
                : `${metrics.requests} requests`}
          </span>
        </div>
      </div>
    </section>
  );
}
