import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Navbar } from "@/components/layout/Navbar";
import { AgentChatPanel } from "@/components/module/AgentChatPanel";
import { CasePdfViewer } from "@/components/module/CasePdfViewer";
import { ProgressTracker } from "@/components/module/ProgressTracker";
import { WorkProductPanel } from "@/components/module/WorkProductPanel";
import { usePersistentState } from "@/hooks/usePersistentState";
import { useSimulation } from "@/hooks/useSimulation";
import type { ChatMessage, ModuleWorkspace, WorkProductDraft } from "@/types";

interface ModuleProgressState {
  completedStepIds: string[];
  pdfScrollTop: number;
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
  pdfScrollTop: 0,
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

function ModuleWorkspaceContent({ module }: { module: ModuleWorkspace }) {
  const navigate = useNavigate();
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

  function completeCurrentStep() {
    const nextStep = module.steps.find(
      (step) => !progress.completedStepIds.includes(step.id),
    );

    if (!nextStep || progress.completedStepIds.includes(nextStep.id)) {
      return;
    }

    const completedStepIds = [...progress.completedStepIds, nextStep.id];
    setProgress((current) => ({
      ...current,
      completedStepIds,
    }));

    if (completedStepIds.length === module.steps.length) {
      navigate(module.readyPath);
    }
  }

  return (
    <div className="eleven-canvas min-h-screen bg-paper text-ink">
      <Navbar />
      <main className="mx-auto max-w-container px-4 pb-8 pt-5 md:px-8 lg:px-12">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/"
            className="rounded-button bg-white px-4 py-2 text-small font-medium text-muted-deep soft-edge transition-colors hover:bg-cloud hover:text-ink"
          >
            Back to dashboard
          </Link>
          <div className="flex flex-wrap items-center gap-2 text-small text-muted-deep">
            <span className="rounded-button bg-white px-3 py-1.5 soft-edge">
              {module.caseCode}
            </span>
            <span className="rounded-button bg-manila px-3 py-1.5 warm-lift">
              {module.evidenceType} open
            </span>
          </div>
        </div>

        <header className="mb-5 rounded-panel bg-white px-5 py-5 soft-edge md:px-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <p className="m-0 text-small font-medium text-oxblood">
                {module.category} · Simulation workspace
              </p>
              <h1 className="m-0 mt-2 max-w-[16ch] font-display text-[42px] font-light leading-[1.04] text-ink md:text-[58px]">
                {module.title}
              </h1>
            </div>
            <div className="max-w-[460px] rounded-panel bg-cloud p-4 text-small text-muted-deep">
              <strong className="block text-ink">{module.artifactLabel}</strong>
              Review the packet, draft the issue log, request list, and associate
              summary in the work product panel, then advance each checklist step.
            </div>
          </div>
        </header>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_460px]">
          <CasePdfViewer
            document={module.casePdf}
            scrollTop={progress.pdfScrollTop}
            zoom={progress.pdfZoom}
            onScrollTopChange={(pdfScrollTop) =>
              setProgress((current) => ({ ...current, pdfScrollTop }))
            }
            onZoomChange={(pdfZoom) =>
              setProgress((current) => ({ ...current, pdfZoom }))
            }
          />

          <aside className="grid gap-4 xl:sticky xl:top-[84px] xl:max-h-[calc(100vh-104px)] xl:overflow-y-auto">
            <ProgressTracker
              steps={module.steps}
              completedStepIds={progress.completedStepIds}
              currentStepId={currentStepId}
              onCompleteCurrent={completeCurrentStep}
              onOpenEvaluation={() => navigate(module.readyPath)}
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
            />
            <AgentChatPanel
              module={module}
              messages={progress.chatMessages}
              onMessagesChange={(chatMessages) =>
                setProgress((current) => ({ ...current, chatMessages }))
              }
            />
          </aside>
        </div>
      </main>
    </div>
  );
}

/** Module workspace — loads simulation data from Firestore by slug. */
export function ModuleWorkspacePage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const { module, loading, error } = useSimulation(slug);

  if (loading) {
    return (
      <div className="eleven-canvas min-h-screen bg-paper text-ink">
        <Navbar />
        <main className="flex min-h-[60vh] items-center justify-center">
          <p className="text-muted-deep">Loading simulation…</p>
        </main>
      </div>
    );
  }

  if (error || !module) {
    return (
      <div className="eleven-canvas min-h-screen bg-paper text-ink">
        <Navbar />
        <main className="flex min-h-[60vh] items-center justify-center">
          <p className="text-muted-deep">{error ?? "Simulation not found."}</p>
        </main>
      </div>
    );
  }

  return <ModuleWorkspaceContent module={module} />;
}
