import { Footer } from "@/components/layout/Footer";
import { ConvergeSection } from "@/components/journey/ConvergeSection";
import { FinalistsSection } from "@/components/journey/FinalistsSection";
import { IdeaExplorer } from "@/components/journey/IdeaExplorer";
import { IdeaSection } from "@/components/journey/IdeaSection";
import { JourneyHero } from "@/components/journey/JourneyHero";
import { JourneyNav } from "@/components/journey/JourneyNav";
import { NextSection } from "@/components/journey/NextSection";

/**
 * The story of how the team went from the "How might we" challenge to the
 * Workplace Flight Simulator — a native rebuild of the Ideation Journey
 * reference page in the SimWorks design system.
 */
export function IdeationJourneyPage() {
  return (
    <div className="min-h-screen w-full bg-paper text-ink">
      <JourneyNav />
      <JourneyHero />
      <IdeaExplorer />
      <ConvergeSection />
      <FinalistsSection />
      <IdeaSection />
      <NextSection />
      <Footer />
    </div>
  );
}
