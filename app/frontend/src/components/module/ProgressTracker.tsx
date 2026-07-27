import { useState } from "react";
import type { ModuleStep } from "@/types";
import type { WorkProductReadiness } from "./workProductReadiness";

interface ProgressTrackerProps {
  steps: ModuleStep[];
  completedStepIds: string[];
  currentStepId: string;
  readiness: WorkProductReadiness;
  validationMessage: string;
  onCompleteCurrent: () => void;
  onOpenEvaluation: () => void;
}

function stepState(
  stepId: string,
  completedStepIds: string[],
  currentStepId: string,
) {
  if (completedStepIds.includes(stepId)) {
    return "Complete";
  }

  return stepId === currentStepId ? "Current" : "Incomplete";
}

function outputForStep(stepId: string, readiness: WorkProductReadiness) {
  if (stepId === "identify-issues") {
    return {
      label: "Draft the issue log",
      ready: readiness.issueLog.ready,
    };
  }

  if (stepId === "draft-requests") {
    return {
      label: "Draft the request list",
      ready: readiness.requestList.ready,
    };
  }

  if (stepId === "final-check") {
    return {
      label: "Write the readiness summary",
      ready: readiness.associateSummary.ready,
    };
  }

  return {
    label: "Review the packet",
    ready: true,
  };
}

/** Persistent checklist for user-controlled module advancement. */
export function ProgressTracker({
  steps,
  completedStepIds,
  currentStepId,
  readiness,
  validationMessage,
  onCompleteCurrent,
  onOpenEvaluation,
}: ProgressTrackerProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const completeCount = completedStepIds.length;
  const allComplete = completeCount === steps.length;
  const primaryActionLabel = allComplete
    ? readiness.allReady
      ? "Review and submit"
      : "Complete submission"
    : "Complete current step";

  function handlePrimaryAction() {
    if (allComplete && !readiness.allReady) {
      return;
    }
    if (allComplete) {
      onOpenEvaluation();
      return;
    }
    onCompleteCurrent();
  }

  return (
    <section className="rounded-panel bg-white p-4 soft-edge">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="m-0 text-micro font-medium text-muted">Progress tracker</p>
          <h2 className="m-0 mt-1 font-display text-[28px] font-light leading-[1.08] text-ink">
            Module checklist
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-button bg-manila px-3 py-1.5 font-mono text-micro text-muted-deep warm-lift">
            {completeCount}/{steps.length}
          </span>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-button bg-cloud text-label font-medium text-muted-deep soft-edge transition-colors hover:bg-silver hover:text-ink"
            aria-expanded={isExpanded}
            aria-controls="module-progress-checklist"
            aria-label={
              isExpanded ? "Collapse progress tracker" : "Expand progress tracker"
            }
            onClick={() => setIsExpanded((current) => !current)}
          >
            <span aria-hidden="true">{isExpanded ? "-" : "+"}</span>
          </button>
        </div>
      </div>

      {isExpanded ? (
        <div id="module-progress-checklist" className="mt-4">
          <div className="mb-4 grid grid-cols-4 gap-1" aria-hidden="true">
            {steps.map((step) => (
              <span
                key={step.id}
                className={
                  "h-1.5 rounded-button " +
                  (completedStepIds.includes(step.id) ? "bg-black" : "bg-silver")
                }
              />
            ))}
          </div>

          <ol className="m-0 space-y-2 p-0">
            {steps.map((step, index) => {
              const state = stepState(step.id, completedStepIds, currentStepId);
              const output = outputForStep(step.id, readiness);

              return (
                <li
                  key={step.id}
                  className={
                    "list-none rounded-panel border p-3 transition-colors " +
                    (state === "Current"
                      ? "border-black bg-white"
                      : "border-hairline bg-cloud")
                  }
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={
                        "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-button border text-micro font-medium " +
                        (state === "Complete"
                          ? "border-black bg-black text-white"
                          : state === "Current"
                            ? "border-black bg-white text-ink"
                            : "border-hairline bg-white text-muted")
                      }
                      aria-hidden="true"
                    >
                      {state === "Complete" ? "✓" : index + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="m-0 text-small font-semibold text-ink">
                          {step.label}
                        </h3>
                        <span className="rounded-button bg-white px-2 py-1 text-micro text-muted soft-edge">
                          {state}
                        </span>
                      </div>
                      <p className="m-0 mt-1 text-small text-muted-deep">
                        {step.description}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-button bg-white px-2 py-1 text-micro text-muted-deep soft-edge">
                          {output.label}
                        </span>
                        {state !== "Complete" && step.id !== "open-packet" ? (
                          <span
                            className={
                              "rounded-button px-2 py-1 text-micro " +
                              (output.ready
                                ? "bg-black text-white"
                                : "bg-manila text-muted-deep")
                            }
                          >
                            {output.ready ? "Ready" : "Needs work"}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>

          <button
            type="button"
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-button bg-black px-4 py-3 text-label font-medium text-white shadow-[rgba(0,0,0,0.4)_0_0_1px,rgba(0,0,0,0.04)_0_4px_4px] transition-[background,transform] hover:-translate-y-0.5 hover:bg-graphite disabled:cursor-not-allowed disabled:bg-slate-mid disabled:hover:translate-y-0"
            onClick={handlePrimaryAction}
            disabled={allComplete && !readiness.allReady}
          >
            {primaryActionLabel}
          </button>
          {validationMessage ? (
            <p className="m-0 mt-3 rounded-panel border border-oxblood/30 bg-manila px-3 py-2 text-small text-oxblood">
              {validationMessage}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
