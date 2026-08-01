import { Button } from "@/components/ui/Button";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { ContinueCard } from "@/components/marketplace/ContinueCard";
import type { ContinueSimulation } from "@/types";

interface HeroProps {
  /** In-progress sim for the continue card; omit to hide the card. */
  continueSim?: ContinueSimulation;
  /** Total number of scenarios available in the marketplace catalog. */
  scenarioCount: number;
  /** Total number of professional pathways represented in the catalog. */
  pathwayCount: number;
  accent?: string;
  onBrowse?: () => void;
  onViewCredentials?: () => void;
  onOpenContinue?: () => void;
}

/** First-screen marketplace introduction with an active simulation module. */
export function Hero({
  continueSim,
  scenarioCount,
  pathwayCount,
  accent,
  onBrowse,
  onViewCredentials,
  onOpenContinue,
}: HeroProps) {
  return (
    <section className="mx-auto grid max-w-container grid-cols-1 gap-10 px-5 pb-8 pt-12 md:px-12 md:pb-6 md:pt-10 lg:min-h-[540px] lg:grid-cols-[minmax(0,0.92fr)_minmax(420px,0.7fr)] lg:items-center">
      <div className="case-enter relative">
        <SectionLabel className="mb-6">SimWorks marketplace</SectionLabel>
        <h1 className="m-0 mb-6 max-w-[11ch] font-display text-[52px] font-light leading-[1.02] text-ink md:text-display">
          Practice the work before the offer.
        </h1>
        <p className="m-0 mb-8 max-w-[58ch] text-body-lg text-muted-deep">
          Build legal, accounting, and analyst judgment in realistic simulations.
          Each run produces inspectable work evidence that can travel with your
          credential.
        </p>
        <div className="mb-10 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button onClick={onBrowse}>Browse simulations</Button>
          <button
            type="button"
            onClick={onViewCredentials}
            className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-button bg-white px-5 py-3 text-label font-medium text-ink soft-edge transition-[background,transform] hover:-translate-y-0.5 hover:bg-cloud"
          >
            View credentials
          </button>
        </div>

        <div className="grid max-w-[620px] grid-cols-3 gap-2">
          <div className="rounded-panel bg-white p-3 soft-edge md:p-4">
            <strong className="block font-display text-[30px] font-light leading-none text-ink md:text-[34px]">
              {scenarioCount}
            </strong>
            <span className="mt-2 block text-micro text-muted-deep md:text-small">
              scenarios
            </span>
          </div>
          <div className="rounded-panel bg-white p-3 soft-edge md:p-4">
            <strong className="block font-display text-[30px] font-light leading-none text-ink md:text-[34px]">
              {pathwayCount}
            </strong>
            <span className="mt-2 block text-micro text-muted-deep md:text-small">
              pathways
            </span>
          </div>
          <div className="rounded-panel bg-white p-3 soft-edge md:p-4">
            <strong className="block font-display text-[30px] font-light leading-none text-ink md:text-[34px]">
              Live
            </strong>
            <span className="mt-2 block text-micro text-muted-deep md:text-small">
              evidence
            </span>
          </div>
        </div>
      </div>

      {continueSim && (
        <ContinueCard
          sim={continueSim}
          accent={accent}
          onOpen={onOpenContinue}
        />
      )}
    </section>
  );
}
