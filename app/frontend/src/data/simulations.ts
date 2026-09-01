import type {
  Category,
  CategoryFilter,
  ContinueSimulation,
  Simulation,
  TrustPartner,
} from "@/types";
import annualAudit from "@/assets/covers/cover-accounting-annual-audit.jpg";
import monthEndClose from "@/assets/covers/cover-accounting-month-end-close.jpg";
import reconcileLedger from "@/assets/covers/cover-accounting-reconcile-ledger.jpg";
import apacPilotPitch from "@/assets/covers/cover-business-analyst-apac-pilot-pitch.jpg";
import backlogPrioritization from "@/assets/covers/cover-business-analyst-backlog-prioritization.jpg";
import missedHandoff from "@/assets/covers/cover-business-analyst-missed-handoff.jpg";
import requirementsGathering from "@/assets/covers/cover-business-analyst-requirements-gathering.jpg";
import stakeholderInterview from "@/assets/covers/cover-business-analyst-stakeholder-interview.jpg";
import theRoomYoureNotIn from "@/assets/covers/cover-leadership-the-room-youre-not-in.jpg";
import clientIntake from "@/assets/covers/cover-legal-client-intake.jpg";
import commercialLease from "@/assets/covers/cover-legal-commercial-lease.jpg";
import maDueDiligence from "@/assets/covers/cover-legal-ma-due-diligence.jpg";
import ndaRedline from "@/assets/covers/cover-legal-nda-redline.jpg";
import kopiRun from "@/assets/covers/cover-onboarding-kopi-run.jpg";
import {
  APAC_PILOT_PITCH_CONTENT,
  MISSED_HANDOFF_CONTENT,
  THE_ROOM_YOURE_NOT_IN_CONTENT,
  FIRST_YEAR_ASSOCIATE_MA_DUE_DILIGENCE_CONTENT,
} from "@/content/simulations";

/** Filter tabs, in reference order. */
export const CATEGORY_FILTERS: CategoryFilter[] = [
  "ALL",
  "LEGAL",
  "ACCOUNTING",
  "BUSINESS ANALYST",
  "LEADERSHIP",
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
  {
    id: 12,
    slug: APAC_PILOT_PITCH_CONTENT.id,
    cat: "BUSINESS ANALYST",
    title: APAC_PILOT_PITCH_CONTENT.title,
    meta: "10 min · Beginner · New",
    cover: apacPilotPitch,
  },
  {
    id: 13,
    slug: MISSED_HANDOFF_CONTENT.id,
    cat: "BUSINESS ANALYST",
    title: MISSED_HANDOFF_CONTENT.title,
    meta: "10 min · Beginner · New",
    cover: missedHandoff,
  },
  {
    id: 14,
    slug: THE_ROOM_YOURE_NOT_IN_CONTENT.id,
    cat: "LEADERSHIP",
    title: THE_ROOM_YOURE_NOT_IN_CONTENT.title,
    meta: "20 min · Advanced · New",
    cover: theRoomYoureNotIn,
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

const CATEGORY_ORDER: Category[] = CATEGORY_FILTERS.filter(
  (category): category is Category => category !== "ALL",
);

/**
 * Filters the catalog by category (`ALL` returns everything). Active cases (slug
 * present) sort before previews; within that, cases group by category in
 * `CATEGORY_FILTERS` order.
 */
export function filterSimulations(
  sims: Simulation[],
  filter: CategoryFilter,
): Simulation[] {
  const filtered = filter === "ALL" ? sims : sims.filter((s) => s.cat === filter);
  return [...filtered].sort((a, b) => {
    const activeDiff = (b.slug ? 1 : 0) - (a.slug ? 1 : 0);
    if (activeDiff !== 0) return activeDiff;
    return CATEGORY_ORDER.indexOf(a.cat) - CATEGORY_ORDER.indexOf(b.cat);
  });
}

/** Cover-art label shown on placeholder art, e.g. "LEGAL · Cover". */
export function coverLabel(cat: Category): string {
  return `${cat} · Cover`;
}

/** Category accent used for cover-art gradients, progress fills, and pathway bars. */
export const CATEGORY_ACCENT: Record<Category, string> = {
  LEGAL: "#8a6a3a",
  ACCOUNTING: "#c1673c",
  "BUSINESS ANALYST": "#4a9fd8",
  LEADERSHIP: "#2f6e73",
  ONBOARDING: "#6b6b6b",
};
