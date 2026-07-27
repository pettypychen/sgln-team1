import type {
  Category,
  CategoryFilter,
  ContinueSimulation,
  Simulation,
  TrustPartner,
} from "@/types";
import annualAudit from "@/assets/covers/cover-accounting-annual-audit.svg";
import monthEndClose from "@/assets/covers/cover-accounting-month-end-close.svg";
import reconcileLedger from "@/assets/covers/cover-accounting-reconcile-ledger.svg";
import backlogPrioritization from "@/assets/covers/cover-business-analyst-backlog-prioritization.svg";
import requirementsGathering from "@/assets/covers/cover-business-analyst-requirements-gathering.svg";
import stakeholderInterview from "@/assets/covers/cover-business-analyst-stakeholder-interview.svg";
import clientIntake from "@/assets/covers/cover-legal-client-intake.svg";
import commercialLease from "@/assets/covers/cover-legal-commercial-lease.svg";
import maDueDiligence from "@/assets/covers/cover-legal-ma-due-diligence.svg";
import ndaRedline from "@/assets/covers/cover-legal-nda-redline.svg";
import kopiRun from "@/assets/covers/cover-onboarding-kopi-run.svg";
import { FIRST_YEAR_ASSOCIATE_MA_DUE_DILIGENCE_CONTENT } from "@/content/simulations";

/** Filter tabs, in reference order. */
export const CATEGORY_FILTERS: CategoryFilter[] = [
  "ALL",
  "LEGAL",
  "ACCOUNTING",
  "BUSINESS ANALYST",
  "ONBOARDING",
];

/** Marketplace catalog. */
export const SIMULATIONS: Simulation[] = [
  { id: 1, slug: "month-end-close-under-pressure", cat: "ACCOUNTING", title: "Month-End Close Under Pressure", meta: "30 min · Beginner · 3,015 completed", cover: monthEndClose },
  { id: 2, cat: "BUSINESS ANALYST", title: "Requirements Gathering Workshop", meta: "35 min · Beginner · 1,780 completed", cover: requirementsGathering },
  { id: 3, cat: "LEGAL", title: "Drafting a Commercial Lease", meta: "50 min · Advanced · 860 completed", cover: commercialLease },
  { id: 4, cat: "ACCOUNTING", title: "Reconciling a Messy Ledger", meta: "40 min · Intermediate · 1,420 completed", cover: reconcileLedger },
  { id: 5, cat: "BUSINESS ANALYST", title: "Stakeholder Interview & Process Mapping", meta: "45 min · Intermediate · 990 completed", cover: stakeholderInterview },
  { id: 6, cat: "LEGAL", title: "Client Intake & Conflict Check", meta: "25 min · Beginner · 2,560 completed", cover: clientIntake },
  { id: 7, cat: "ACCOUNTING", title: "Preparing for the Annual Audit", meta: "55 min · Advanced · 640 completed", cover: annualAudit },
  { id: 8, cat: "BUSINESS ANALYST", title: "Backlog Prioritization Standup", meta: "30 min · Intermediate · 1,120 completed", cover: backlogPrioritization },
  { id: 9, cat: "LEGAL", title: "Reviewing an NDA Redline", meta: "35 min · Intermediate · 1,340 completed", cover: ndaRedline },
  {
    id: 10,
    slug: FIRST_YEAR_ASSOCIATE_MA_DUE_DILIGENCE_CONTENT.slug,
    cat: FIRST_YEAR_ASSOCIATE_MA_DUE_DILIGENCE_CONTENT.category,
    title: FIRST_YEAR_ASSOCIATE_MA_DUE_DILIGENCE_CONTENT.title,
    meta: `${FIRST_YEAR_ASSOCIATE_MA_DUE_DILIGENCE_CONTENT.estimatedMinutes} min · ${FIRST_YEAR_ASSOCIATE_MA_DUE_DILIGENCE_CONTENT.difficulty} · 0 completed`,
    cover: maDueDiligence,
  },
  {
    id: 11,
    slug: "kopi-run",
    cat: "ONBOARDING",
    title: "Kopi Run",
    meta: "5 min · Beginner · New",
    cover: kopiRun,
  },
];

/** Hero "continue" card — from referenceHTML hero markup. */
export const CONTINUE_SIMULATION: ContinueSimulation = {
  slug: FIRST_YEAR_ASSOCIATE_MA_DUE_DILIGENCE_CONTENT.slug,
  cat: "LEGAL",
  title: FIRST_YEAR_ASSOCIATE_MA_DUE_DILIGENCE_CONTENT.title,
  progress: 60,
  status: "60% complete · 18 min left",
  cover: maDueDiligence,
};

/**
 * Trust-bar partners — semi-realistic Singapore professional-services firms,
 * each paired with a monochrome logo mark drawn from a local landmark or motif
 * (see the `LOGO_MARKS` registry in `TrustBar`).
 */
export const TRUST_PARTNERS: TrustPartner[] = [
  { name: "Tembusu Legal LLP", logo: "tembusu" }, // Tembusu tree ($5 note)
  { name: "Raffles & Tan", logo: "raffles" }, // colonial-era audit house
  { name: "Straits Union Bank", logo: "straits" }, // Singapore Strait
  { name: "Merlion Advisory", logo: "merlion" }, // Merlion emblem
  { name: "Orchard Partners", logo: "orchard" }, // Vanda orchid / Orchard Rd
];

/** Filters the catalog by category (`ALL` returns everything). Active cases (slug present) sort before previews. */
export function filterSimulations(
  sims: Simulation[],
  filter: CategoryFilter,
): Simulation[] {
  const filtered = filter === "ALL" ? sims : sims.filter((s) => s.cat === filter);
  return [...filtered].sort((a, b) => (b.slug ? 1 : 0) - (a.slug ? 1 : 0));
}

/** Cover-art label shown on placeholder art, e.g. "LEGAL · Cover". */
export function coverLabel(cat: Category): string {
  return `${cat} · Cover`;
}
