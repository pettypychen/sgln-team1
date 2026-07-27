import { useEffect, useMemo, useState } from "react";
import type { WorkProductDraft } from "@/types";
import { GuidedNotesEditor } from "./GuidedNotesEditor";
import { IssueLogEditor } from "./IssueLogEditor";
import { RequestListEditor } from "./RequestListEditor";
import {
  buildWorkProductReadiness,
  type DeliverableReadiness,
} from "./workProductReadiness";

type WorkProductTab = "issueLog" | "requestList" | "associateSummary";
type WorkMode = "guided" | "structured";

interface WorkProductPanelProps {
  draft: WorkProductDraft;
  currentStepId: string;
  onDraftChange: (draft: WorkProductDraft) => void;
  onSubmitForGrading: () => void;
}

const MODE_STORAGE_KEY = "simworks:first-year-associate-ma-due-diligence:workmode";

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

function whatToWrite(tab: WorkProductTab) {
  if (tab === "issueLog") {
    return "Log at least 12 gating issues — section, issue, why it matters, risk, and next step.";
  }
  if (tab === "requestList") {
    return "List at least 10 targeted documents or confirmations, grouped by category.";
  }
  return "Write a concise summary under 350 words: readiness, top gating issues, next workstream, specialist input.";
}

const SUMMARY_PLACEHOLDER =
  "The agreement is not ready for signature because…";

function getInitialMode(): WorkMode {
  if (typeof window === "undefined") {
    return "guided";
  }
  const stored = window.localStorage.getItem(MODE_STORAGE_KEY);
  return stored === "structured" ? "structured" : "guided";
}

/** Persistent drafting surface for learner work product. */
export function WorkProductPanel({
  draft,
  currentStepId,
  onDraftChange,
  onSubmitForGrading,
}: WorkProductPanelProps) {
  const [mode, setMode] = useState<WorkMode>(getInitialMode);
  const [activeTab, setActiveTab] = useState<WorkProductTab>(
    tabForStep(currentStepId),
  );
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    setActiveTab(tabForStep(currentStepId));
  }, [currentStepId]);

  const readiness = useMemo(() => buildWorkProductReadiness(draft), [draft]);

  function selectMode(next: WorkMode) {
    setMode(next);
    window.localStorage.setItem(MODE_STORAGE_KEY, next);
  }

  function updateActiveValue(value: string) {
    onDraftChange({ ...draft, [activeTab]: value });
  }

  function handleSave() {
    setJustSaved(true);
    window.setTimeout(() => setJustSaved(false), 1800);
  }

  const dashboard: { label: string; item: DeliverableReadiness }[] = [
    { label: "Issues", item: readiness.issueLog },
    { label: "Requests", item: readiness.requestList },
    { label: "Summary", item: readiness.associateSummary },
  ];
  const activeReadiness = readiness[activeTab];

  return (
    <section className="flex min-h-[680px] min-w-0 flex-col overflow-hidden rounded-panel bg-white soft-edge lg:h-full lg:min-h-0">
      {/* Header + condensed status dashboard */}
      <div className="border-b border-hairline px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="m-0 text-micro font-medium text-muted">Work product</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {dashboard.map(({ label, item }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-button bg-cloud px-2.5 py-1 text-micro text-muted-deep"
                title={item.message}
              >
                <span
                  className={
                    "h-1.5 w-1.5 shrink-0 rounded-button " +
                    (item.ready
                      ? "bg-teal"
                      : item.count > 0
                        ? "bg-amber"
                        : "bg-silver")
                  }
                  aria-hidden="true"
                />
                {label}{" "}
                <span className="font-mono">
                  {label === "Summary" ? `${item.count}w` : `${item.count}/${label === "Issues" ? 12 : 10}`}
                </span>
              </span>
            ))}
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
        </div>

        {/* Mode tabs */}
        <div
          className="mt-3 grid grid-cols-2 gap-1 rounded-button bg-cloud p-1"
          role="tablist"
          aria-label="Workspace mode"
        >
          {(
            [
              { id: "structured", label: "Structured Form", hint: "Fielded" },
              { id: "guided", label: "Guided Notes", hint: "Recommended" },
            ] as { id: WorkMode; label: string; hint: string }[]
          ).map((option) => {
            const isActive = mode === option.id;
            return (
              <button
                key={option.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={
                  "flex items-center justify-center gap-2 rounded-button px-3 py-2 text-small font-medium transition-colors " +
                  (isActive
                    ? "bg-black text-white"
                    : "text-muted-deep hover:bg-white hover:text-ink")
                }
                onClick={() => selectMode(option.id)}
              >
                {option.label}
                <span
                  className={
                    "rounded-button px-1.5 py-0.5 text-micro font-normal " +
                    (isActive ? "bg-white/20 text-white" : "bg-white text-muted")
                  }
                >
                  {option.hint}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Guided mode: single distraction-free editor */}
      {mode === "guided" ? (
        <div className="flex min-h-0 flex-1 flex-col px-4 py-3">
          <p className="m-0 mb-2 text-small leading-snug text-muted-deep">
            Analyze the PDF on the left and document all findings in one place.
            Keep the three headers. Switch to Structured Form for guided fields.
          </p>
          <div className="min-h-[360px] flex-1">
            <GuidedNotesEditor draft={draft} onDraftChange={onDraftChange} />
          </div>
        </div>
      ) : (
        /* Structured mode: deliverable sub-nav + fielded editor */
        <>
          <div className="flex flex-wrap items-center gap-1.5 border-b border-hairline px-4 py-2.5">
            {TABS.map((tab) => {
              const item = readiness[tab.id];
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  className={
                    "inline-flex items-center gap-2 rounded-button px-3 py-1.5 text-small font-medium transition-colors " +
                    (isActive
                      ? "bg-black text-white"
                      : "bg-cloud text-muted-deep hover:bg-manila hover:text-ink")
                  }
                  onClick={() => setActiveTab(tab.id)}
                >
                  <span
                    className={
                      "h-1.5 w-1.5 rounded-button " +
                      (item.ready
                        ? "bg-teal"
                        : item.count > 0
                          ? "bg-amber"
                          : isActive
                            ? "bg-white/50"
                            : "bg-silver")
                    }
                    aria-hidden="true"
                  />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex min-h-0 flex-1 flex-col px-4 py-3">
            <p className="m-0 mb-2 text-small leading-snug text-muted-deep">
              {whatToWrite(activeTab)}
            </p>
            <div className="min-h-[340px] flex-1">
              {activeTab === "issueLog" ? (
                <IssueLogEditor
                  value={draft.issueLog}
                  onChange={updateActiveValue}
                />
              ) : activeTab === "requestList" ? (
                <RequestListEditor
                  value={draft.requestList}
                  onChange={updateActiveValue}
                />
              ) : (
                <textarea
                  className="h-full min-h-[320px] w-full resize-none rounded-panel border border-hairline bg-white px-4 py-4 text-body leading-relaxed text-ink outline-none transition-colors placeholder:text-muted focus:border-black focus:ring-2 focus:ring-black/10"
                  aria-label="Associate summary"
                  placeholder={SUMMARY_PLACEHOLDER}
                  value={draft.associateSummary}
                  onChange={(event) => updateActiveValue(event.target.value)}
                  spellCheck
                />
              )}
            </div>
            <p
              className={
                "m-0 mt-2 rounded-button px-3 py-1.5 text-micro transition-colors " +
                (activeReadiness.ready
                  ? "bg-cloud text-muted-deep"
                  : "bg-manila text-oxblood")
              }
            >
              {activeReadiness.message}
            </p>
          </div>
        </>
      )}

      {/* Sticky action footer */}
      <div className="flex items-center justify-between gap-2 border-t border-hairline bg-[#fbfaf7] px-4 py-3">
        <span className="text-micro text-muted" aria-live="polite">
          {justSaved ? "Saved ✓" : "Autosaved locally"}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-button bg-white px-3.5 py-2 text-small font-medium text-ink soft-edge transition-colors hover:bg-cloud"
            onClick={handleSave}
          >
            Save progress
          </button>
          <button
            type="button"
            className="rounded-button bg-black px-4 py-2 text-small font-medium text-white transition-colors hover:bg-graphite"
            onClick={onSubmitForGrading}
          >
            Review and submit
          </button>
        </div>
      </div>
    </section>
  );
}
