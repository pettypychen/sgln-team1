/**
 * Shared case rubric for the M&A due diligence simulation.
 *
 * In the AI-native workspace the learner works the case by reasoning with the
 * agent, so the same topic patterns that used to grade a typed work product now
 * measure how much of the case the learner has articulated in conversation.
 * Keeping the rubric in one place lets the live coverage tracker and the
 * conversation grader stay in lockstep.
 */

import type { ChatMessage, ModuleWorkspace } from "@/types";

export interface RubricTopic {
  label: string;
  pattern: RegExp;
}

/** Eight gating-issue areas the learner is expected to surface. */
export const ISSUE_TOPICS: RubricTopic[] = [
  {
    label: "Party identity & authority",
    pattern:
      /legal name|address|charter|capital|surplus|undivided|board resolution|incumbenc|authoriz|officer/,
  },
  {
    label: "Regulatory approval",
    pattern:
      /occ|comptroller|regulat|merger certificate|state bank|approval path|filing|notice/,
  },
  {
    label: "Shareholder approval",
    pattern:
      /shareholder|two-?thirds|\bvote\b|record date|proxy|dissenter|appraisal|meeting/,
  },
  {
    label: "Financial condition & capital",
    pattern:
      /financial statement|call report|capital adequ|book value|fair value|acceptable asset|statement of condition|valuation/,
  },
  {
    label: "Consideration mechanics",
    pattern:
      /exchange ratio|fractional|scrip|cash|consideration|transfer agent|exchange agent|par value/,
  },
  {
    label: "Asset & liability transfer",
    pattern:
      /asset vest|liabilit|trust department|litigation|contingent|off-?balance|third-?party consent/,
  },
  {
    label: "Interim covenants & closing conditions",
    pattern:
      /dividend|ordinary course|covenant|interim|leakage|bring-?down|closing condition/,
  },
  {
    label: "Governance & closing documents",
    pattern:
      /board composition|director|articles of association|execution block|secretary certificate|officer certificate|closing deliverable|outside date|termination/,
  },
];

/** Four request-list groupings the learner is expected to build. */
export const REQUEST_TOPICS: RubricTopic[] = [
  {
    label: "Corporate authority",
    pattern: /resolution|charter|bylaw|good standing|incumbenc|authoriz/,
  },
  {
    label: "Regulatory & shareholder approvals",
    pattern: /occ|regulat|shareholder|proxy|\bvote\b|approval|filing/,
  },
  {
    label: "Financial / capital / consideration",
    pattern:
      /financial statement|call report|capital|valuation|book value|exchange ratio|consideration|acceptable asset/,
  },
  {
    label: "Liabilities & operations",
    pattern:
      /litigation|liabilit|trust|lease|real estate|contract|consent|schedule|off-?balance/,
  },
];

/** Four moves that make an associate-ready readiness call. */
export const SUMMARY_SIGNALS: RubricTopic[] = [
  {
    label: "Readiness conclusion",
    pattern: /not ready|ready for signature|cannot be signed|not.*sign|isn't ready|is not ready/,
  },
  {
    label: "Top gating issues named",
    pattern:
      /occ|regulat|shareholder|two-?thirds|financial statement|capital adequ|valuation|exchange ratio|consideration|liabilit|trust|outside date|closing condition|legal opinion|articles|board authorit/,
  },
  {
    label: "First workstream",
    pattern: /first|begin with|start with|workstream|priority|prioriti|next step/,
  },
  {
    label: "Specialist input",
    pattern:
      /counsel|tax|accounting|securities|trust|fiduciary|secretary|specialist|regulatory counsel/,
  },
];

export const REQUEST_ROLE_PATTERN =
  /counsel|secretary|client|tax|accounting|transfer agent|regulat|auditor|opposing|fiduciary|specialist/;

/** Concatenated text of the learner's own turns — what they have articulated. */
export function learnerText(messages: ChatMessage[]): string {
  return messages
    .filter((message) => message.role === "user")
    .map((message) => message.content)
    .join("\n")
    .toLowerCase();
}

export function matchedTopics(text: string, topics: RubricTopic[]): RubricTopic[] {
  const normalized = text.toLowerCase();
  return topics.filter((topic) => topic.pattern.test(normalized));
}

/** How many learner turns carry real substance (used as an effort signal). */
export function substantiveTurnCount(messages: ChatMessage[]): number {
  return messages.filter(
    (message) => message.role === "user" && message.content.trim().length >= 40,
  ).length;
}

/**
 * System prompt that turns the model into a supervising associate running a
 * Socratic case dialogue. The learner reaches the answer by reasoning; the
 * agent pushes, tests, and cites the packet rather than handing over a memo.
 */
export function buildSystemPrompt(module: ModuleWorkspace): string {
  const caseContext = (module.caseMarkdown ?? "").slice(0, 8000);

  return [
    `You are a supervising senior associate at the law firm advising Rivergate National Bank on its merger with Harbor Community Bank. You are coaching a first-year associate (the user) through diligence on the draft merger agreement.`,
    ``,
    `SIMULATION: "${module.title}" (${module.caseCode}).`,
    `The learner answers this case *through conversation with you* — there is no separate document to fill in. Your job is to develop their reasoning, not to do the work for them.`,
    ``,
    `HOW TO COACH:`,
    `- Run a Socratic dialogue. Ask sharp follow-ups, surface what they missed, and make them commit to a position (issue, risk level, request, readiness call).`,
    `- Anchor every point in the evidence packet below. Cite the specific clause, blank, or drafting note when you can.`,
    `- Guide them to cover, over the session: (1) the gating diligence issues — authority, regulatory approval, shareholder approval, capital/financial condition, consideration mechanics, asset/liability transfer, interim covenants/closing conditions, governance/closing documents; (2) targeted diligence requests grouped by category; (3) a readiness summary that states whether the agreement can be signed, names the top gating issues, the first workstream, and where a specialist is needed.`,
    `- Do NOT dump the full answer. Give one focused nudge or correction per turn, then hand the thinking back to them.`,
    `- Keep replies tight (usually under 160 words). Be direct and professional, like a busy associate.`,
    `- Rivergate is the client and would be the surviving national banking association.`,
    ``,
    `EVIDENCE PACKET (source of truth):`,
    caseContext,
  ].join("\n");
}
