import { Badge } from "@/components/ui/Badge";
import { CoverArt } from "@/components/ui/CoverArt";
import { coverLabel } from "@/data/simulations";
import type { ContinueSimulation } from "@/types";

interface ContinueCardProps {
  sim: ContinueSimulation;
  /** Accent color for badge and progress fill. */
  accent?: string;
  onOpen?: () => void;
}

/** Live in-progress simulation module for the hero. */
export function ContinueCard({
  sim,
  accent = "#f5f2ef",
  onOpen,
}: ContinueCardProps) {
  return (
    <article className="case-enter group overflow-hidden rounded-panel bg-surface-dark text-white soft-edge transition-transform duration-300 hover:-translate-y-1">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div className="text-small text-silver">Active simulation</div>
        <div className="rounded-button bg-white/8 px-3 py-1.5 font-mono text-micro text-silver">
          SW-LEGAL-184
        </div>
      </div>

      <CoverArt label={coverLabel(sim.cat)} src={sim.cover} aspect="16 / 6.8">
        <div className="absolute left-4 top-4 z-10">
          <Badge color={accent}>In progress</Badge>
        </div>
        <div className="absolute bottom-4 right-4 z-10 rounded-button bg-black/72 px-3 py-2 text-micro text-white backdrop-blur-sm">
          18 min left
        </div>
      </CoverArt>

      <div className="px-5 pb-5 pt-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-small font-medium text-manila">{sim.cat}</div>
          <div className="text-small text-silver">Due diligence memo</div>
        </div>
        <h2 className="m-0 mb-5 max-w-[18ch] font-display text-[34px] font-light leading-[1.08]">
          {sim.title}
        </h2>

        <div className="mb-5">
          <div className="mb-2 flex items-center justify-between text-small text-silver">
            <span>{sim.status}</span>
            <span>{sim.progress}%</span>
          </div>
          <div className="grid h-2 grid-cols-10 gap-1 rounded-button bg-white/[0.06] p-1">
            {Array.from({ length: 10 }).map((_, index) => (
              <span
                key={index}
                className="block rounded-button"
                style={{
                  background:
                    index < Math.round(sim.progress / 10)
                      ? accent
                      : "rgba(255,255,255,0.12)",
                }}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-white/10 pt-4">
          <span className="text-small text-silver">Evidence packet open</span>
          <button
            type="button"
            className="rounded-button bg-white px-4 py-2 text-label font-medium text-black"
            onClick={onOpen}
          >
            Resume case
          </button>
        </div>
      </div>
    </article>
  );
}
