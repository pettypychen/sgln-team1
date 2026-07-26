/** Shared domain types for SimWorks. */

/** A simulation category. `ALL` is the filter-only pseudo-category. */
export type Category =
  | "LEGAL"
  | "ACCOUNTING"
  | "BUSINESS ANALYST"
  | "ONBOARDING";

export type CategoryFilter = "ALL" | Category;

/** A marketplace simulation listing. */
export interface Simulation {
  id: number;
  /** Stable content slug for module routing/imports. */
  slug?: string;
  cat: Category;
  title: string;
  /** Pre-formatted meta line, e.g. "30 min · Beginner · 3,015 completed". */
  meta: string;
  /** Resolved URL of the cover image (imported asset). */
  cover?: string;
}

/** A partner wordmark shown in the trust bar. `logo` keys into the SVG mark
 *  registry in `TrustBar`; `name` is the rendered wordmark text. */
export interface TrustPartner {
  name: string;
  logo: "tembusu" | "raffles" | "straits" | "merlion" | "orchard";
}

/** An in-progress simulation shown in the hero "continue" card. */
export interface ContinueSimulation {
  /** Stable content slug for module routing/imports. */
  slug?: string;
  cat: Category;
  title: string;
  /** 0–100. */
  progress: number;
  /** Pre-formatted status, e.g. "60% complete · 18 min left". */
  status: string;
  /** Resolved URL of the cover image (imported asset). */
  cover?: string;
}

export interface CasePdfPage {
  heading: string;
  kicker: string;
  body: string[];
  evidence: string[];
}

export interface CasePdf {
  title: string;
  fileName: string;
  pageCount: number;
  pages: CasePdfPage[];
}

export interface ModuleStep {
  id: string;
  label: string;
  description: string;
}

export interface WorkProductDraft {
  issueLog: string;
  requestList: string;
  associateSummary: string;
}

export interface ModuleWorkspace {
  id: string;
  caseCode: string;
  category: Category;
  title: string;
  artifactLabel: string;
  evidenceType: string;
  caseMarkdown: string;
  evaluationMarkdown: string;
  readyPath: string;
  storageKey: string;
  casePdf: CasePdf;
  steps: ModuleStep[];
}

export interface ChatMessage {
  id: string;
  role: "agent" | "user";
  content: string;
  status: "sent" | "loading" | "failed";
}
