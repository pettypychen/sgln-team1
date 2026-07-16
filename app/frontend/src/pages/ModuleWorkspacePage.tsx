import { useMemo, useState, type CSSProperties, type PointerEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AgentChatPanel } from "@/components/module/AgentChatPanel";
import { CasePdfViewer } from "@/components/module/CasePdfViewer";
import { ProgressTracker } from "@/components/module/ProgressTracker";
import { WorkProductPanel } from "@/components/module/WorkProductPanel";
import { GradingPanel } from "@/components/module/GradingPanel";
import {
  buildWorkProductReadiness,
  deliverableForStep,
} from "@/components/module/workProductReadiness";
import {
  gradeWorkProduct,
  type GradeReport,
} from "@/components/module/workProductGrader";
import { usePersistentState } from "@/hooks/usePersistentState";
import { MA_DUE_DILIGENCE_MODULE } from "@/data/moduleWorkspace";
import type { ChatMessage, WorkProductDraft } from "@/types";

interface ModuleProgressState {
  completedStepIds: string[];
  pdfPage: number;
  pdfZoom: number;
  chatMessages: ChatMessage[];
  workProduct: WorkProductDraft;
}

const INITIAL_WORK_PRODUCT: WorkProductDraft = {
  issueLog:
    "| Section | Issue | Why It Matters | Risk | Next Step |\n| --- | --- | --- | --- | --- |\n",
  requestList:
    "## Corporate Authority\n\n## Regulatory and Shareholder Approval\n\n## Financial / Capital / Consideration\n\n## Liabilities and Operations\n\n## Closing Documents\n",
  associateSummary: "",
};

const INITIAL_PROGRESS: ModuleProgressState = {
  completedStepIds: [],
  pdfPage: 1,
  pdfZoom: 1,
  workProduct: INITIAL_WORK_PRODUCT,
  chatMessages: [
    {
      id: "agent-welcome",
      role: "agent",
      content:
        "I can help you reason from the evidence packet. Ask about risks, memo structure, or source evidence when useful.",
      status: "sent",
    },
  ],
};

const SPLIT_STORAGE_KEY = "simworks:first-year-associate-ma-due-diligence:split";

type WorkspaceMode = "balanced" | "reading" | "writing";

function getInitialSplitPercent() {
  if (typeof window === "undefined") {
    return 50;
  }

  const stored = Number(window.localStorage.getItem(SPLIT_STORAGE_KEY));
  return Number.isFinite(stored) ? Math.min(66, Math.max(38, stored)) : 50;
}

function modeForSplit(splitPercent: number): WorkspaceMode {
  if (splitPercent >= 58) {
    return "reading";
  }

  if (splitPercent <= 42) {
    return "writing";
  }

  return "balanced";
}

/** Module workspace for the active M&A due diligence simulation. */
export function ModuleWorkspacePage() {
  const module = MA_DUE_DILIGENCE_MODULE;
  const navigate = useNavigate();
  const [advanceMessage, setAdvanceMessage] = useState("");
  const [splitPercent, setSplitPercent] = useState(getInitialSplitPercent);
  const [isProgressOpen, setIsProgressOpen] = useState(false);
  const [isAgentOpen, setIsAgentOpen] = useState(false);
  const [isGradingOpen, setIsGradingOpen] = useState(false);
  const [gradingStatus, setGradingStatus] = useState<"loading" | "ready">(
    "loading",
  );
  const [gradeReport, setGradeReport] = useState<GradeReport | null>(null);
  const [progress, setProgress] = usePersistentState<ModuleProgressState>(
    module.storageKey,
    INITIAL_PROGRESS,
  );

  const currentStepId = useMemo(
    () =>
      module.steps.find((step) => !progress.completedStepIds.includes(step.id))
        ?.id ?? module.steps[module.steps.length - 1].id,
    [module.steps, progress.completedStepIds],
  );
  const workProduct = progress.workProduct ?? INITIAL_WORK_PRODUCT;
  const workProductReadiness = useMemo(
    () => buildWorkProductReadiness(workProduct),
    [workProduct],
  );
  const currentStepDeliverable = deliverableForStep(currentStepId);
  const currentStepValidationMessage =
    currentStepDeliverable &&
    !workProductReadiness[currentStepDeliverable].ready
      ? advanceMessage
      : "";
  const completeCount = progress.completedStepIds.length;
  const allStepsComplete = completeCount === module.steps.length;
  const workspaceMode = modeForSplit(splitPercent);

  function updateSplitPercent(nextPercent: number) {
    const clamped = Math.min(66, Math.max(38, Math.round(nextPercent)));
    setSplitPercent(clamped);
    window.localStorage.setItem(SPLIT_STORAGE_KEY, String(clamped));
  }

  function applyWorkspaceMode(mode: WorkspaceMode) {
    if (mode === "reading") {
      updateSplitPercent(64);
      return;
    }

    if (mode === "writing") {
      updateSplitPercent(40);
      return;
    }

    updateSplitPercent(50);
  }

  function handleDividerPointerDown(event: PointerEvent<HTMLButtonElement>) {
    const container = event.currentTarget.parentElement;
    if (!container) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = container.getBoundingClientRect();

    function handlePointerMove(moveEvent: globalThis.PointerEvent) {
      const nextPercent = ((moveEvent.clientX - rect.left) / rect.width) * 100;
      updateSplitPercent(nextPercent);
    }

    function handlePointerUp() {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  function completeCurrentStep() {
    const nextStep = module.steps.find(
      (step) => !progress.completedStepIds.includes(step.id),
    );

    if (!nextStep || progress.completedStepIds.includes(nextStep.id)) {
      return;
    }

    const requiredDeliverable = deliverableForStep(nextStep.id);
    if (
      requiredDeliverable &&
      !workProductReadiness[requiredDeliverable].ready
    ) {
      setAdvanceMessage(workProductReadiness[requiredDeliverable].message);
      return;
    }

    const completedStepIds = [...progress.completedStepIds, nextStep.id];
    setAdvanceMessage("");
    setProgress((current) => ({
      ...current,
      completedStepIds,
    }));

    if (completedStepIds.length === module.steps.length) {
      navigate(module.readyPath);
    }
  }

  function runGrading() {
    setGradingStatus("loading");
    setGradeReport(null);
    window.setTimeout(() => {
      setGradeReport(gradeWorkProduct(workProduct));
      setGradingStatus("ready");
    }, 1100);
  }

  function openGrading() {
    setIsGradingOpen(true);
    runGrading();
  }

  return (
    <div className="min-h-screen bg-[#eeede9] text-ink">
      <header className="sticky top-0 z-40 border-b border-hairline bg-[#fbfaf7]/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-[1720px] flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              to="/"
              className="inline-flex min-h-10 items-center rounded-button bg-white px-4 py-2 text-small font-medium text-muted-deep soft-edge transition-colors hover:bg-cloud hover:text-ink"
            >
              Back
            </Link>
            <div className="min-w-0">
              <p className="m-0 truncate text-micro font-medium text-muted">
                {module.caseCode} · {module.category}
              </p>
              <h1 className="m-0 truncate text-label font-semibold text-ink">
                {module.title}
              </h1>
            </div>
          </div>

          <div
            className="flex flex-wrap items-center gap-2 text-small text-muted-deep"
            aria-live="polite"
          >
            <span className="rounded-button bg-white px-3 py-1.5 soft-edge">
              {workProductReadiness.readyCount}/3 ready
            </span>
            <span className="hidden rounded-button bg-white px-3 py-1.5 font-mono text-micro soft-edge md:inline-flex">
              Issues {workProductReadiness.issueLog.count}/12 · Requests{" "}
              {workProductReadiness.requestList.count}/10 · Summary{" "}
              {workProductReadiness.associateSummary.count}/350
            </span>
            <button
              type="button"
              className="rounded-button bg-white px-3 py-1.5 text-small font-medium text-ink soft-edge transition-colors hover:bg-cloud"
              onClick={() => setIsProgressOpen(true)}
            >
              Progress {completeCount}/{module.steps.length}
            </button>
            <button
              type="button"
              className="rounded-button bg-white px-3 py-1.5 text-small font-medium text-ink soft-edge transition-colors hover:bg-cloud"
              onClick={() => setIsAgentOpen(true)}
            >
              Ask AI
            </button>
            <button
              type="button"
              className="rounded-button bg-black px-4 py-2 text-small font-medium text-white transition-colors hover:bg-graphite"
              onClick={
                allStepsComplete
                  ? () => navigate(module.readyPath)
                  : completeCurrentStep
              }
            >
              {allStepsComplete ? "Evaluate" : "Complete step"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-[1720px] flex-col gap-3 px-4 py-4 md:px-6">
        {currentStepValidationMessage ? (
          <div className="rounded-panel border border-oxblood/30 bg-manila px-4 py-3 text-small text-oxblood">
            {currentStepValidationMessage}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-panel border border-hairline bg-[#fbfaf7] px-3 py-2 soft-edge">
          <div className="flex items-center gap-2">
            <span className="rounded-button bg-manila px-3 py-1.5 text-micro font-medium text-muted-deep warm-lift">
              {module.evidenceType} open
            </span>
            <span className="text-small text-muted-deep">
              Read the packet, then draft the issue log, requests, and summary.
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1 rounded-button bg-cloud p-1">
            {(["balanced", "reading", "writing"] as WorkspaceMode[]).map(
              (mode) => (
                <button
                  key={mode}
                  type="button"
                  className={
                    "rounded-button px-3 py-1.5 text-small font-medium capitalize transition-colors " +
                    (workspaceMode === mode
                      ? "bg-black text-white"
                      : "text-muted-deep hover:bg-white hover:text-ink")
                  }
                  onClick={() => applyWorkspaceMode(mode)}
                >
                  {mode}
                </button>
              ),
            )}
          </div>
        </div>

        <section
          className="relative grid min-h-[calc(100vh-168px)] gap-3 lg:grid-cols-[minmax(0,var(--source-fr))_12px_minmax(0,var(--work-fr))]"
          style={
            {
              "--source-fr": `${splitPercent}fr`,
              "--work-fr": `${100 - splitPercent}fr`,
            } as CSSProperties
          }
        >
          <CasePdfViewer
            document={module.casePdf}
            page={progress.pdfPage}
            zoom={progress.pdfZoom}
            onPageChange={(pdfPage) =>
              setProgress((current) => ({ ...current, pdfPage }))
            }
            onZoomChange={(pdfZoom) =>
              setProgress((current) => ({ ...current, pdfZoom }))
            }
          />

          <button
            type="button"
            className="hidden cursor-col-resize rounded-button bg-black/10 transition-colors hover:bg-black/30 lg:block"
            aria-label="Resize source and work product panes"
            onPointerDown={handleDividerPointerDown}
          />

          <WorkProductPanel
            draft={workProduct}
            currentStepId={currentStepId}
            onDraftChange={(nextWorkProduct) =>
              setProgress((current) => ({
                ...current,
                workProduct: nextWorkProduct,
              }))
            }
            onSubmitForGrading={openGrading}
          />
        </section>
      </main>

      {isProgressOpen ? (
        <div className="fixed inset-0 z-50 bg-black/24" role="presentation">
          <button
            type="button"
            className="absolute inset-0 h-full w-full cursor-default"
            aria-label="Close progress drawer"
            onClick={() => setIsProgressOpen(false)}
          />
          <aside className="absolute right-0 top-0 flex h-full w-full max-w-[460px] flex-col bg-[#fbfaf7] p-4 shadow-[-24px_0_60px_rgba(0,0,0,0.18)]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="m-0 text-micro font-medium text-muted">
                  Simulation progress
                </p>
                <h2 className="m-0 text-card font-light leading-tight text-ink">
                  Checklist
                </h2>
              </div>
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-button bg-white text-label font-medium text-ink soft-edge"
                aria-label="Close progress drawer"
                onClick={() => setIsProgressOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="min-h-0 overflow-y-auto">
              <ProgressTracker
                steps={module.steps}
                completedStepIds={progress.completedStepIds}
                currentStepId={currentStepId}
                readiness={workProductReadiness}
                validationMessage={currentStepValidationMessage}
                onCompleteCurrent={completeCurrentStep}
                onOpenEvaluation={() => navigate(module.readyPath)}
              />
            </div>
          </aside>
        </div>
      ) : null}

      {isAgentOpen ? (
        <div className="fixed inset-0 z-50 bg-black/24" role="presentation">
          <button
            type="button"
            className="absolute inset-0 h-full w-full cursor-default"
            aria-label="Close AI drawer"
            onClick={() => setIsAgentOpen(false)}
          />
          <aside className="absolute right-0 top-0 flex h-full w-full max-w-[480px] flex-col bg-[#fbfaf7] p-4 shadow-[-24px_0_60px_rgba(0,0,0,0.18)]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="m-0 text-micro font-medium text-muted">
                  Optional support
                </p>
                <h2 className="m-0 text-card font-light leading-tight text-ink">
                  Ask AI
                </h2>
              </div>
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-button bg-white text-label font-medium text-ink soft-edge"
                aria-label="Close AI drawer"
                onClick={() => setIsAgentOpen(false)}
              >
                ×
              </button>
            </div>
            <AgentChatPanel
              module={module}
              messages={progress.chatMessages}
              onMessagesChange={(chatMessages) =>
                setProgress((current) => ({ ...current, chatMessages }))
              }
            />
          </aside>
        </div>
      ) : null}

      {isGradingOpen ? (
        <GradingPanel
          status={gradingStatus}
          report={gradeReport}
          onClose={() => setIsGradingOpen(false)}
          onRerun={runGrading}
          onOpenEvaluation={() => navigate(module.readyPath)}
        />
      ) : null}
    </div>
  );
}
