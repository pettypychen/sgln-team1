import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { IdeationJourneyPage } from "@/pages/IdeationJourneyPage";
import { MarketplacePage } from "@/pages/MarketplacePage";
import { ModuleWorkspacePage } from "@/pages/ModuleWorkspacePage";
import { ReadyForEvaluationPage } from "@/pages/ReadyForEvaluationPage";

/**
 * App router. Only the marketplace exists today; routing is wired so future
 * pages (My Simulations, Credentials, Settings) drop in without refactoring.
 */
export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MarketplacePage />} />
        <Route path="/journey" element={<IdeationJourneyPage />} />
        <Route
          path="/simulations/first-year-associate-ma-due-diligence"
          element={<ModuleWorkspacePage />}
        />
        <Route
          path="/simulations/first-year-associate-ma-due-diligence/ready"
          element={<ReadyForEvaluationPage />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
