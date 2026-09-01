import type { CaseDefinition, RubricCriterion } from "./types";

const criterion = (
  id: string,
  dimension: RubricCriterion["dimension"],
  label: string,
  maxPoints: number,
  description: string,
  criticalFailure = false,
): RubricCriterion => ({
  id,
  dimension,
  label,
  maxPoints,
  description,
  criticalFailure,
});

export const CASE_DEFINITIONS: CaseDefinition[] = [
  {
    id: "first-year-associate-ma-due-diligence",
    title: "First-Year Associate: M&A Due Diligence",
    category: "Legal",
    version: "1.0.0",
    evaluationMode: "human_final",
    released: true,
    badge: {
      symbol: "§",
      name: "Diligence Counsel",
      palette: "from-[#591f2b] via-[#9b3849] to-[#d6a85f]",
    },
    rubric: {
      caseId: "first-year-associate-ma-due-diligence",
      caseVersion: "1.0.0",
      rubricVersion: "1.0.0",
      caseThreshold: 56,
      interactionThreshold: 14,
      criteria: [
        criterion("legal-transaction-map", "case_outcome", "Transaction map", 12, "Accurately maps the parties, structure, approvals, and closing sequence."),
        criterion("legal-issue-log", "case_outcome", "Diligence issue log", 24, "Identifies at least twelve case-specific issues and explains their consequence."),
        criterion("legal-request-list", "case_outcome", "Targeted request list", 18, "Requests evidence that resolves the identified risks."),
        criterion("legal-summary", "case_outcome", "Associate summary", 16, "States readiness, gating issues, next workstream, and specialist input."),
        criterion("legal-source-use", "ai_interaction", "Evidence-grounded prompting", 10, "Uses packet references and asks the AI to connect advice to source evidence."),
        criterion("legal-challenge", "ai_interaction", "Verification and challenge", 10, "Checks AI claims and corrects unsupported or inaccurate suggestions."),
        criterion("legal-judgment", "ai_interaction", "Professional judgment", 10, "Uses AI as support without delegating the final legal judgment.", true),
      ],
    },
  },
  {
    id: "month-end-close-under-pressure",
    title: "Month-End Close Under Pressure",
    category: "Accounting",
    version: "1.0.0",
    evaluationMode: "human_final",
    released: true,
    badge: {
      symbol: "Σ",
      name: "Close Controller",
      palette: "from-[#173f55] via-[#2f7186] to-[#d1ad64]",
    },
    rubric: {
      caseId: "month-end-close-under-pressure",
      caseVersion: "1.0.0",
      rubricVersion: "1.0.0",
      caseThreshold: 52,
      interactionThreshold: 14,
      criteria: [
        criterion("close-exceptions", "case_outcome", "Exception identification", 24, "Finds the deterministic duplicate, timing, unposted, accrual, unusual, and treatment exceptions."),
        criterion("close-calculations", "case_outcome", "Calculation verification", 18, "Recalculates affected totals and clearly distinguishes verified from unresolved amounts."),
        criterion("close-priority", "case_outcome", "Close blocker prioritization", 14, "Prioritizes items that prevent a reliable close."),
        criterion("close-update", "case_outcome", "Manager update", 14, "Provides a concise readiness summary, owners, and next actions."),
        criterion("close-prompting", "ai_interaction", "Structured artifact use", 10, "Directs AI across the ledger, checklist, and manager notes."),
        criterion("close-challenge", "ai_interaction", "Calculation challenge", 12, "Detects and corrects an AI calculation or classification error.", true),
        criterion("close-boundary", "ai_interaction", "Control boundary", 8, "Proposes investigation or corrections without claiming to post entries."),
      ],
    },
  },
  {
    id: "requirements-gathering-workshop",
    title: "Requirements Gathering Workshop",
    category: "Business Analyst",
    version: "fixture-1",
    evaluationMode: "human_final",
    released: false,
    badge: {
      symbol: "◇",
      name: "Requirements Facilitator",
      palette: "from-[#3b315d] via-[#6a5a96] to-[#c5a969]",
    },
    rubric: {
      caseId: "requirements-gathering-workshop",
      caseVersion: "fixture-1",
      rubricVersion: "fixture-1",
      caseThreshold: 42,
      interactionThreshold: 14,
      criteria: [
        criterion("ba-discovery", "case_outcome", "Discovery coverage", 20, "Fixture criterion pending colleague-approved release content."),
        criterion("ba-requirements", "case_outcome", "Requirements quality", 20, "Fixture criterion pending colleague-approved release content."),
        criterion("ba-workshop", "case_outcome", "Workshop synthesis", 20, "Fixture criterion pending colleague-approved release content."),
        criterion("ba-prompting", "ai_interaction", "AI-assisted inquiry", 15, "Uses AI to broaden questions without fabricating stakeholder answers."),
        criterion("ba-validation", "ai_interaction", "Assumption validation", 15, "Labels and verifies assumptions before treating them as requirements.", true),
      ],
    },
  },
  {
    id: "kopi-run",
    title: "Kopi Run",
    category: "Onboarding",
    version: "1.0.0",
    evaluationMode: "human_final",
    released: true,
    submissionTitle: "Your answers",
    workProductPlaceholder: "Aiman | K03 | Kopi O Kosong | SGD 1.40\nBeatrice | ...\nCheryl | ...\nTotal | SGD ...",
    badge: {
      symbol: "☕",
      name: "Kopi Coordinator",
      palette: "from-[#4a2515] via-[#a8623a] to-[#d5a646]",
    },
    rubric: {
      caseId: "kopi-run",
      caseVersion: "1.0.0",
      rubricVersion: "1.0.0",
      caseThreshold: 36,
      interactionThreshold: 12,
      criteria: [
        criterion("kopi-orders", "case_outcome", "Order translation", 36, "Maps all three preferences to valid menu item codes using the supplied glossary."),
        criterion("kopi-total", "case_outcome", "Price and total verification", 12, "Verifies each price and calculates the final total."),
        criterion("kopi-source-check", "ai_interaction", "Source-grounded check", 12, "Asks the AI to verify at least one order against the supplied menu or glossary."),
        criterion("kopi-final", "ai_interaction", "Clear final order", 8, "Produces a readable three-person order with a total."),
      ],
    },
  },
  {
    id: "apac-pilot-pitch",
    title: "Pitching the APAC pilot",
    category: "Business Analyst",
    version: "1.0.0",
    evaluationMode: "human_final",
    released: true,
    submissionTitle: "Your recommendation",
    workProductPlaceholder: "Write the seven minutes as you would say it to your APAC Product Lead…",
    badge: {
      symbol: "\u21c4",
      name: "Cross-Culture Navigator",
      palette: "from-[#25384f] via-[#4f6f9d] to-[#c9b072]",
    },
    rubric: {
      caseId: "apac-pilot-pitch",
      caseVersion: "1.0.0",
      rubricVersion: "1.0.0",
      caseThreshold: 30,
      interactionThreshold: 10,
      criteria: [
        criterion("pitch-plan", "case_outcome", "The recommendation", 32, "Sets out how to open, the order of information, and the full ask inside seven minutes: six-month pilot, USD 600,000, two global engineers."),
        criterion("pitch-adaptation", "case_outcome", "Signals to watch", 20, "Names at least one signal to watch for in the room and what to change if Jordan reacts differently than expected."),
        criterion("pitch-dimensions", "ai_interaction", "Culture map reasoning", 12, "Works the culture map dimensions with the AI, grounded in the profile, and the recommendation follows from what was concluded."),
        criterion("pitch-pressure-test", "ai_interaction", "Pressure-tested hypothesis", 8, "Asks the AI to challenge at least one placement instead of accepting the first reading."),
      ],
    },
  },
  {
    id: "missed-handoff-conversation",
    title: "The missed handoff",
    category: "Business Analyst",
    version: "1.0.0",
    evaluationMode: "human_final",
    released: true,
    submissionTitle: "Your recommendation",
    workProductPlaceholder: "Write the conversation as you would advise her to run it…",
    badge: {
      symbol: "\u2696",
      name: "Accountability Coach",
      palette: "from-[#2f2a3d] via-[#5f5a7d] to-[#c9a45f]",
    },
    rubric: {
      caseId: "missed-handoff-conversation",
      caseVersion: "1.0.0",
      rubricVersion: "1.0.0",
      caseThreshold: 30,
      interactionThreshold: 10,
      criteria: [
        criterion("handoff-plan", "case_outcome", "The recommendation", 32, "Sets out how to open, the order of the conversation, where accountability lands, how the honest account is invited, and the expectations and escalation rights agreed before the meeting ends."),
        criterion("handoff-adaptation", "case_outcome", "Signals to watch", 20, "Names at least one signal to watch for in the room — including Rohan going quiet — and what to change in response."),
        criterion("handoff-dimensions", "ai_interaction", "Culture map reasoning", 12, "Works the culture map dimensions with the AI, grounded in the profile, and the recommendation follows from what was concluded."),
        criterion("handoff-pressure-test", "ai_interaction", "Pressure-tested hypothesis", 8, "Asks the AI to challenge at least one placement instead of accepting the first reading."),
      ],
    },
  },
  {
    id: "the-room-youre-not-in",
    title: "The Room You're Not In",
    category: "Leadership",
    version: "1.0.0",
    evaluationMode: "human_final",
    released: true,
    submissionTitle: "The 5% plan",
    workProductPlaceholder: "The plan, the words, and what she says to herself on the night\u2026",
    badge: {
      symbol: "\u25c9",
      name: "Executive Presence Lead",
      palette: "from-[#12313a] via-[#2f6e73] to-[#d8b45c]",
    },
    rubric: {
      caseId: "the-room-youre-not-in",
      caseVersion: "1.0.0",
      rubricVersion: "1.0.0",
      caseThreshold: 28,
      interactionThreshold: 12,
      criteria: [
        criterion("room-plan", "case_outcome", "The 5% plan", 26, "Commits to a small number of moments and names what is given up, ties each to a named person and the specific perception the record shows needs moving, accounts for the cost of what it takes on, and would not read the same for any executive at any company."),
        criterion("room-words", "case_outcome", "The words", 22, "Writes what Serene actually says out loud rather than describing an approach, sized for the slot it is written for, pitched at the altitude that room can act on, and recognisable as her rather than as campaigning."),
        criterion("room-rules", "ai_interaction", "Rules of the game", 10, "Works the visibility gap and the unwritten rules with the AI, reasoning each read from what a person has said, promoted or already seen rather than from job title or seniority, and the plan follows from what was concluded."),
        criterion("room-challenge", "ai_interaction", "Pressure-tested", 8, "Asks the AI to challenge the plan, argue for a discarded option, or attack the words the way the room will, and engages with what comes back instead of accepting the first reading."),
        criterion("room-voice", "ai_interaction", "Naming the little voice", 6, "Identifies the self-talk that would stop her on the day, separates the legitimate objection from the excuse doing its work, and gives her something to do when it arrives."),
      ],
    },
  },
];

export function getCaseDefinition(caseId: string): CaseDefinition {
  const definition = CASE_DEFINITIONS.find((item) => item.id === caseId);
  if (!definition) {
    throw new Error(`Unknown case: ${caseId}`);
  }
  return definition;
}

const SOURCE_ARTIFACT_IDS: Record<string, string[]> = {
  "first-year-associate-ma-due-diligence": ["agreement-packet.md"],
  "month-end-close-under-pressure": [
    "general-ledger.csv",
    "close-checklist.csv",
    "manager-notes.md",
  ],
  "requirements-gathering-workshop": ["requirements-workshop-packet.md"],
  "kopi-run": ["kopi-menu.csv", "colleague-orders.csv", "kopi-glossary.md"],
  "apac-pilot-pitch": ["culture-map.md", "jordan-whitaker-profile.md"],
  "missed-handoff-conversation": ["culture-map.md", "rohan-krishnan-profile.md"],
  "the-room-youre-not-in": [
    "visibility-record.md",
    "seven-weeks.md",
    "five-percent-zone.md",
  ],
};

export function sourceArtifactsForCase(caseId: string) {
  const definition = getCaseDefinition(caseId);
  return (SOURCE_ARTIFACT_IDS[caseId] ?? [`${caseId}-packet`]).map((id) => ({
    id,
    version: definition.version,
  }));
}

export function validateRubric(definition: CaseDefinition): string[] {
  const errors: string[] = [];
  if (definition.version !== definition.rubric.caseVersion) {
    errors.push("Case and rubric versions do not match.");
  }
  if (definition.rubric.rubricVersion.trim().length === 0) {
    errors.push("Rubric version is required.");
  }
  const ids = new Set<string>();
  for (const item of definition.rubric.criteria) {
    if (ids.has(item.id)) errors.push(`Duplicate criterion ID: ${item.id}`);
    ids.add(item.id);
    if (item.maxPoints <= 0) errors.push(`${item.id} must have positive points.`);
  }
  for (const dimension of ["case_outcome", "ai_interaction"] as const) {
    if (!definition.rubric.criteria.some((item) => item.dimension === dimension)) {
      errors.push(`Missing ${dimension} criteria.`);
    }
  }
  return errors;
}
