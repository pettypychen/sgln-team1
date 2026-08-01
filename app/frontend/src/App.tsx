import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { IdeationJourneyPage } from "@/pages/IdeationJourneyPage";
import { LoginPage } from "@/pages/LoginPage";
import { MarketplacePage } from "@/pages/MarketplacePage";
import { ModuleWorkspacePage } from "@/pages/ModuleWorkspacePage";
import { ReadyForEvaluationPage } from "@/pages/ReadyForEvaluationPage";
import { EvaluatorQueuePage } from "@/pages/EvaluatorQueuePage";
import { EvaluatorReviewPage } from "@/pages/EvaluatorReviewPage";
import { CredentialsPage } from "@/pages/CredentialsPage";
import { PublicCredentialPage } from "@/pages/PublicCredentialPage";
import { PrototypeCasePage } from "@/pages/PrototypeCasePage";
import { AdminDashboard } from "@/pages/AdminDashboard";
import { getParticipantEmail, getParticipantName } from "@/participant/session";

function RequireParticipant() {
  return getParticipantName() && getParticipantEmail() ? <Outlet /> : <Navigate to="/login" replace />;
}

/**
 * App router. Only the marketplace exists today; routing is wired so future
 * pages (My Simulations, Credentials, Settings) drop in without refactoring.
 */
export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireParticipant />}>
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
          <Route path="/simulations/:caseId/ready" element={<ReadyForEvaluationPage />} />
          <Route path="/simulations/:caseId" element={<PrototypeCasePage />} />
          <Route path="/credentials" element={<CredentialsPage />} />
        </Route>
        <Route path="/eval/all-cases" element={<EvaluatorQueuePage />} />
        <Route
          path="/eval/all-cases/:attemptId"
          element={<EvaluatorReviewPage />}
        />
        <Route path="/verify/:publicToken" element={<PublicCredentialPage />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
