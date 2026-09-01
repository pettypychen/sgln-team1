import type { CSSProperties } from "react";
import { SimulationCard } from "@/components/marketplace/SimulationCard";
import type { Simulation } from "@/types";

interface SimulationGridProps {
  sims: Simulation[];
  /** Column count (reference editor prop: 2–4, default 3). */
  columns?: number;
}

/** Responsive marketplace shelf of professional scenarios. */
export function SimulationGrid({ sims, columns = 3 }: SimulationGridProps) {
  return (
    <section id="simulation-library" className="mx-auto max-w-container px-5 pb-16 pt-10 md:px-12 md:pb-20 md:pt-12">
      <div className="mb-6 flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <div className="mb-2 text-small font-medium text-muted-deep">
            Simulation library
          </div>
          <h2 className="m-0 font-display text-[40px] leading-[1.1] text-ink">
            Pick the situation to rehearse.
          </h2>
        </div>
        <div className="rounded-button bg-white px-4 py-2 text-small text-muted-deep soft-edge">
          {sims.length} case{sims.length === 1 ? "" : "s"} available in this
          view
        </div>
      </div>
      <div
        className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:[grid-template-columns:var(--sim-cols)]"
        style={
          {
            "--sim-cols": `repeat(${columns}, minmax(0, 1fr))`,
          } as CSSProperties
        }
      >
        {sims.map((sim) => (
          <SimulationCard key={sim.id} sim={sim} />
        ))}
      </div>
    </section>
  );
}
