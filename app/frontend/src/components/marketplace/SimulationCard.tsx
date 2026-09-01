import { CoverArt } from "@/components/ui/CoverArt";
import { CATEGORY_ACCENT, coverLabel } from "@/data/simulations";
import type { Category, Simulation } from "@/types";
import { Link } from "react-router-dom";

interface SimulationCardProps {
  sim: Simulation;
}

const CATEGORY_EVIDENCE: Record<Category, string> = {
  LEGAL: "Issue log / redline judgment",
  ACCOUNTING: "Reconciliation workbook",
  "BUSINESS ANALYST": "Stakeholder decision brief",
  LEADERSHIP: "Decision-ready executive message",
  ONBOARDING: "Constraint and verification check",
};

function splitMeta(meta: string) {
  const [duration = "", difficulty = "", completed = ""] = meta.split(" · ");
  return { duration, difficulty, completed };
}

/** A professional scenario card with evidence and assessment cues. */
export function SimulationCard({ sim }: SimulationCardProps) {
  const accent = CATEGORY_ACCENT[sim.cat];
  const { duration, difficulty, completed } = splitMeta(sim.meta);

  const card = (
    <article className={`case-enter group grid min-h-[470px] grid-rows-[auto_1fr] overflow-hidden rounded-card bg-white soft-edge transition-[box-shadow,transform] duration-300 ${sim.slug ? "cursor-pointer hover:-translate-y-1 hover:shadow-[rgba(0,0,0,0.075)_0_0_0_0.5px_inset,rgba(0,0,0,0.08)_0_0_0_1px,rgba(0,0,0,0.06)_0_12px_30px]" : ""}`}>
      <CoverArt
        label={coverLabel(sim.cat)}
        src={sim.cover}
        accent={accent}
        aspect="16 / 9"
        className="border-b border-hairline"
      >
        <div className="absolute left-4 top-4 z-10 h-2 w-8 rounded-button" style={{ background: accent }} />
        <div className="absolute bottom-3 left-4 z-10 rounded-button bg-black/72 px-3 py-2 text-micro text-white backdrop-blur-sm">
          Case {String(sim.id).padStart(2, "0")}
        </div>
      </CoverArt>

      <div className="flex min-h-0 flex-col p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="mb-2 text-small font-medium" style={{ color: accent }}>
              {sim.cat}
            </div>
            <h3 className="m-0 text-pretty font-display text-card text-ink">
              {sim.title}
            </h3>
          </div>
          <span className="shrink-0 rounded-button bg-manila/80 px-3 py-2 font-mono text-micro text-muted-deep warm-lift">
            SW-{String(sim.id).padStart(3, "0")}
          </span>
        </div>

        <div className="mb-4 grid grid-cols-3 divide-x divide-hairline rounded-panel bg-cloud text-center">
          <span className="px-2 py-3">
            <strong className="block text-small text-ink">{duration}</strong>
            <span className="text-micro text-muted">Time</span>
          </span>
          <span className="px-2 py-3">
            <strong className="block text-small text-ink">{difficulty}</strong>
            <span className="text-micro text-muted">Level</span>
          </span>
          <span className="px-2 py-3">
            <strong className="block text-small text-ink">{completed.replace(" completed", "")}</strong>
            <span className="text-micro text-muted">Runs</span>
          </span>
        </div>

        <div className="mt-auto border-t border-hairline pt-4">
          <div className="mb-4 flex items-center justify-between gap-4 text-small">
            <span className="text-muted-deep">{CATEGORY_EVIDENCE[sim.cat]}</span>
            <span className="shrink-0 text-micro text-muted">
              Evidence
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex gap-1" aria-hidden="true">
              {Array.from({ length: 5 }).map((_, index) => (
                <span
                  key={index}
                  className="h-1.5 w-8 rounded-button"
                  style={{
                    background:
                      index < (difficulty === "Advanced" ? 5 : difficulty === "Intermediate" ? 4 : 3)
                        ? accent
                        : "#e8e5df",
                  }}
                />
              ))}
            </div>
            <span className={`rounded-button px-4 py-2 text-label font-medium ${sim.slug ? "bg-black text-white transition-colors group-hover:bg-graphite" : "bg-cloud text-muted"}`}>
              {sim.slug ? "Start case" : "Preview only"}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
  return sim.slug ? (
    <Link className="text-inherit no-underline" to={`/simulations/${sim.slug}`}>
      {card}
    </Link>
  ) : card;
}
