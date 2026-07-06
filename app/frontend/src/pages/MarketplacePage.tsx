import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/marketplace/Hero";
import { CategoryTabs } from "@/components/marketplace/CategoryTabs";
import { SimulationGrid } from "@/components/marketplace/SimulationGrid";
import { TrustBar } from "@/components/marketplace/TrustBar";
import {
  CATEGORY_FILTERS,
  CONTINUE_SIMULATION,
  filterSimulations,
  SIMULATIONS,
  TRUST_PARTNERS,
} from "@/data/simulations";
import type { CategoryFilter } from "@/types";

interface MarketplacePageProps {
  /** Grid column count (reference editor prop: 2–4, default 3). */
  columns?: number;
  /** Whether to show the hero "continue" card (reference default: true). */
  showContinue?: boolean;
  /** Accent color for the continue card (reference default: white). */
  accent?: string;
}

/**
 * The SimWorks marketplace page. Owns the only piece of real interactive state
 * from the reference — the active category filter — and threads it to the tabs
 * and grid. Everything else is presentational.
 */
export function MarketplacePage({
  columns = 3,
  showContinue = true,
  accent = "#f5f2ef",
}: MarketplacePageProps) {
  const [activeCat, setActiveCat] = useState<CategoryFilter>("ALL");
  const navigate = useNavigate();

  const visibleSims = useMemo(
    () => filterSimulations(SIMULATIONS, activeCat),
    [activeCat],
  );

  return (
    <div className="eleven-canvas min-h-screen w-full bg-paper text-ink">
      <Navbar />
      <Hero
        continueSim={showContinue ? CONTINUE_SIMULATION : undefined}
        scenarioCount={SIMULATIONS.length}
        accent={accent}
        onOpenContinue={() =>
          navigate("/simulations/first-year-associate-ma-due-diligence")
        }
      />
      <CategoryTabs
        categories={CATEGORY_FILTERS}
        active={activeCat}
        onChange={setActiveCat}
      />
      <SimulationGrid sims={visibleSims} columns={columns} />
      <TrustBar partners={TRUST_PARTNERS} />
      <Footer />
    </div>
  );
}
