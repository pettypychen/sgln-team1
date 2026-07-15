/**
 * Client-side heuristic grader for the M&A due diligence work product.
 *
 * There is no backend evaluator in this simulation, so this module mirrors
 * the six competencies and point weights from `evaluation.md` and produces a
 * scannable report card (score, per-competency breakdown, strengths, gaps).
 * It is deterministic and keyword-driven — an approximation meant to give the
 * learner directional feedback, not an authoritative grade.
 */

import type { WorkProductDraft } from "@/types";
import {
  countIssueRows,
  countRequests,
  countWords,
} from "./workProductReadiness";
import { composeGuidedDoc } from "./guidedNotes";

export interface CompetencyResult {
  id: string;
  label: string;
  earned: number;
  max: number;
  note: string;
}

export type GradeVerdict = "distinction" | "pass" | "developing";

export interface GradeReport {
  total: number;
  max: number;
  passing: number;
  distinction: number;
  verdict: GradeVerdict;
  headline: string;
  competencies: CompetencyResult[];
  strengths: string[];
  gaps: string[];
}

const MAX_SCORE = 100;
const PASSING_SCORE = 70;
const DISTINCTION_SCORE = 88;

interface Topic {
  label: string;
  pattern: RegExp;
}

const ISSUE_TOPICS: Topic[] = [
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

const REQUEST_TOPICS: Topic[] = [
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

const ROLE_PATTERN =
  /counsel|secretary|client|tax|accounting|transfer agent|regulat|auditor|opposing|fiduciary|specialist/;

const GATING_PATTERN =
  /occ|regulat|shareholder|two-?thirds|financial statement|capital adequ|valuation|exchange ratio|consideration|liabilit|trust|outside date|closing condition|legal opinion|articles|board authorit/;

function ratioToPoints(matched: number, total: number, max: number): number {
  if (total === 0) {
    return 0;
  }
  return Math.round((matched / total) * max);
}

function matchedTopics(text: string, topics: Topic[]): Topic[] {
  const normalized = text.toLowerCase();
  return topics.filter((topic) => topic.pattern.test(normalized));
}

/** Extract the Risk column from each issue-log table row. */
function issueRiskLabels(issueLog: string): string[] {
  return issueLog
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.startsWith("|") &&
        !line.includes("---") &&
        !line.toLowerCase().includes("section | issue"),
    )
    .map((line) => {
      const cells = line.split("|").map((cell) => cell.trim());
      return (cells[4] ?? "").toLowerCase();
    });
}

/** Only the user-entered issue-log cells, excluding header and separator rows. */
function issueContentText(issueLog: string): string {
  return issueLog
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.startsWith("|") &&
        !line.includes("---") &&
        !line.toLowerCase().includes("section | issue"),
    )
    .join("\n");
}

/** Only the user-entered request bullets, excluding the fixed "## Category" headings. */
function requestContentText(requestList: string): string {
  return requestList
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+\S/.test(line))
    .join("\n");
}

export function gradeWorkProduct(draft: WorkProductDraft): GradeReport {
  // Match keywords against user-entered content only. The structured editors
  // always emit fixed scaffolding (table header row, "## Category" headings),
  // which would otherwise inflate topic coverage regardless of real input.
  const issueContent = issueContentText(draft.issueLog);
  const requestContent = requestContentText(draft.requestList);
  const combined =
    `${issueContent}\n${requestContent}\n${draft.associateSummary}`.toLowerCase();

  const issueCount = countIssueRows(draft.issueLog);
  const requestCount = countRequests(draft.requestList);
  const summaryWords = countWords(draft.associateSummary);

  const strengths: string[] = [];
  const gaps: string[] = [];

  // 1. Agreement comprehension & transaction mapping — 15 pts
  const mappingSignals: Topic[] = [
    { label: "parties", pattern: /rivergate|harbor/ },
    { label: "direction", pattern: /merge into|surviving|national bank charter/ },
    { label: "approvals", pattern: /occ|shareholder|state/ },
    { label: "signing vs closing", pattern: /signature|signing|closing|before/ },
    { label: "financial/consideration", pattern: /capital|exchange ratio|financial|consideration/ },
    { label: "asset/liability", pattern: /asset|liabilit|trust/ },
    { label: "timing/closing", pattern: /outside date|closing|termination|timetable/ },
  ];
  const mappingMatched = matchedTopics(combined, mappingSignals).length;
  const comprehension: CompetencyResult = {
    id: "comprehension",
    label: "Agreement comprehension & transaction mapping",
    max: 15,
    earned: ratioToPoints(mappingMatched, mappingSignals.length, 15),
    note: `Transaction elements referenced: ${mappingMatched}/${mappingSignals.length}.`,
  };

  // 2. Substantive issue spotting — 30 pts
  const issueMatches = matchedTopics(issueContent, ISSUE_TOPICS);
  const coveragePoints = ratioToPoints(issueMatches.length, ISSUE_TOPICS.length, 22);
  const volumePoints = Math.min(8, Math.round((Math.min(issueCount, 12) / 12) * 8));
  const issueSpotting: CompetencyResult = {
    id: "issues",
    label: "Substantive issue spotting",
    max: 30,
    earned: Math.min(30, coveragePoints + volumePoints),
    note: `${issueMatches.length}/${ISSUE_TOPICS.length} issue areas covered · ${issueCount}/12 logged rows.`,
  };
  const missingIssueTopics = ISSUE_TOPICS.filter(
    (topic) => !issueMatches.includes(topic),
  );
  missingIssueTopics.forEach((topic) =>
    gaps.push(`No issue logged on ${topic.label.toLowerCase()}.`),
  );
  issueMatches
    .slice(0, 3)
    .forEach((topic) => strengths.push(`${topic.label} identified in the issue log.`));

  // 3. Risk prioritization & judgment — 15 pts
  const riskLabels = issueRiskLabels(draft.issueLog);
  const labeled = riskLabels.filter((label) =>
    /^(high|medium|low)$/.test(label),
  ).length;
  const labelConsistency =
    riskLabels.length === 0
      ? 0
      : ratioToPoints(labeled, riskLabels.length, 6);
  const hasNextSteps = /next step|request|confirm|obtain|review|counsel/.test(
    draft.issueLog.toLowerCase(),
  );
  const prioritization: CompetencyResult = {
    id: "judgment",
    label: "Risk prioritization & judgment",
    max: 15,
    earned: Math.min(
      15,
      labelConsistency +
        (labeled >= 4 ? 5 : labeled >= 2 ? 3 : 0) +
        (hasNextSteps ? 4 : 0),
    ),
    note:
      riskLabels.length === 0
        ? "No risk labels detected."
        : `${labeled}/${riskLabels.length} rows use High/Medium/Low.`,
  };
  if (riskLabels.length > 0 && labeled < riskLabels.length) {
    gaps.push("Some issue rows are missing a High / Medium / Low risk label.");
  }

  // 4. Diligence request quality — 15 pts
  const requestMatches = matchedTopics(requestContent, REQUEST_TOPICS);
  const countPoints = requestCount >= 10 ? 5 : requestCount >= 8 ? 3 : requestCount >= 5 ? 2 : requestCount > 0 ? 1 : 0;
  const coveragePts = requestMatches.length * 1.5;
  const routingPts = ROLE_PATTERN.test(requestContent.toLowerCase()) ? 3 : 0;
  const groupingPts = requestCount > 0 ? 2 : 0;
  const requestQuality: CompetencyResult = {
    id: "requests",
    label: "Diligence request quality",
    max: 15,
    earned: Math.min(15, Math.round(countPoints + coveragePts + routingPts + groupingPts)),
    note: `${requestCount}/10 requests · ${requestMatches.length}/${REQUEST_TOPICS.length} topic areas.`,
  };
  if (requestCount < 10) {
    gaps.push(`Request list has ${requestCount}/10 — add ${Math.max(0, 10 - requestCount)} more.`);
  }
  if (routingPts === 0 && requestCount > 0) {
    gaps.push("Requests do not route to a source or specialist (e.g. regulatory counsel, tax, secretary).");
  }

  // 5. Associate-facing communication — 15 pts
  const summary = draft.associateSummary.toLowerCase();
  const withinWordLimit = summaryWords > 0 && summaryWords <= 350;
  const readinessAnswer = /not ready|ready for signature|cannot be signed|not.*sign/.test(summary);
  const gatingHits = (summary.match(GATING_PATTERN) ?? []).length;
  const firstWorkstream = /first|begin with|start with|workstream|priority|next/.test(summary);
  const specialist = /counsel|tax|accounting|securities|trust|fiduciary|secretary|specialist/.test(summary);
  const communication: CompetencyResult = {
    id: "communication",
    label: "Associate-facing communication",
    max: 15,
    earned: Math.min(
      15,
      (withinWordLimit ? 3 : 0) +
        (readinessAnswer ? 2 : 0) +
        Math.min(6, gatingHits >= 3 ? 6 : gatingHits * 2) +
        (firstWorkstream ? 2 : 0) +
        (specialist ? 2 : 0),
    ),
    note:
      summaryWords === 0
        ? "Associate summary is empty."
        : `${summaryWords} words · readiness ${readinessAnswer ? "stated" : "unclear"}.`,
  };
  if (summaryWords > 350) {
    gaps.push(`Summary is ${summaryWords} words — trim to 350 or fewer.`);
  }
  if (summaryWords > 0 && !readinessAnswer) {
    gaps.push("Summary does not clearly state whether the agreement is ready for signature.");
  }

  // 6. Professional format & completeness — 10 pts
  // The exported submission (composeGuidedDoc) always includes the exact
  // required top-level Markdown headers, so this competency's header points
  // are guaranteed by the tooling regardless of edit mode.
  const guidedDoc = composeGuidedDoc(draft);
  const hasHeaders =
    /# diligence issue log/i.test(guidedDoc) &&
    /# diligence request list/i.test(guidedDoc) &&
    /# associate summary/i.test(guidedDoc);
  const hasTable = /\| section \| issue \| why it matters \| risk \| next step \|/i.test(
    draft.issueLog,
  );
  const countsOk = issueCount >= 12 && requestCount >= 10;
  const format: CompetencyResult = {
    id: "format",
    label: "Professional format & completeness",
    max: 10,
    earned: Math.min(
      10,
      (hasHeaders ? 3 : 0) +
        (hasTable ? 2 : 0) +
        (issueCount >= 12 ? 1 : 0) +
        (requestCount >= 10 ? 1 : 0) +
        (withinWordLimit ? 1 : 0) +
        2,
    ),
    note: countsOk
      ? "Structure, headers, and counts look complete."
      : "Required counts or structure incomplete.",
  };

  const competencies = [
    comprehension,
    issueSpotting,
    prioritization,
    requestQuality,
    communication,
    format,
  ];

  const total = competencies.reduce((sum, c) => sum + c.earned, 0);

  const verdict: GradeVerdict =
    total >= DISTINCTION_SCORE
      ? "distinction"
      : total >= PASSING_SCORE
        ? "pass"
        : "developing";

  const headline =
    verdict === "distinction"
      ? "Distinction — this reads like a supervising-associate-ready work product."
      : verdict === "pass"
        ? "Passing — solid coverage with a few gaps to close before it is client-ready."
        : "Developing — the core issues are not yet fully covered. Keep building.";

  if (strengths.length === 0) {
    strengths.push("Add content to the deliverables to start earning credit.");
  }

  return {
    total,
    max: MAX_SCORE,
    passing: PASSING_SCORE,
    distinction: DISTINCTION_SCORE,
    verdict,
    headline,
    competencies,
    strengths: strengths.slice(0, 4),
    gaps: gaps.slice(0, 6),
  };
}
