/**
 * Client-side heuristic grader for the AI-native workspace.
 *
 * The learner's deliverable is the conversation itself, so this grader scores
 * the transcript against the same six competencies and weights as the original
 * work-product grader (from `evaluation.md`). It reads the learner's own turns
 * — their reasoning — and produces the same `GradeReport` shape the grading
 * panel already renders. Deterministic and keyword-driven: directional
 * feedback, not an authoritative grade.
 */

import type { ChatMessage } from "@/types";
import type { CompetencyResult, GradeReport, GradeVerdict } from "./workProductGrader";
import {
  ISSUE_TOPICS,
  REQUEST_TOPICS,
  REQUEST_ROLE_PATTERN,
  SUMMARY_SIGNALS,
  learnerText,
  matchedTopics,
  substantiveTurnCount,
} from "./caseRubric";

const MAX_SCORE = 100;
const PASSING_SCORE = 70;
const DISTINCTION_SCORE = 88;

function ratioToPoints(matched: number, total: number, max: number): number {
  if (total === 0) {
    return 0;
  }
  return Math.round((matched / total) * max);
}

export function gradeConversation(messages: ChatMessage[]): GradeReport {
  const text = learnerText(messages);
  const turns = substantiveTurnCount(messages);

  const strengths: string[] = [];
  const gaps: string[] = [];

  // 1. Agreement comprehension & transaction mapping — 15 pts
  const mappingSignals = [
    { label: "parties", pattern: /rivergate|harbor/ },
    { label: "direction", pattern: /merge into|surviving|national bank charter|survivor/ },
    { label: "approvals", pattern: /occ|shareholder|state/ },
    { label: "signing vs closing", pattern: /signature|signing|closing|before/ },
    { label: "financial/consideration", pattern: /capital|exchange ratio|financial|consideration/ },
    { label: "asset/liability", pattern: /asset|liabilit|trust/ },
    { label: "timing/closing", pattern: /outside date|closing|termination|timetable/ },
  ];
  const mappingMatched = matchedTopics(text, mappingSignals).length;
  const comprehension: CompetencyResult = {
    id: "comprehension",
    label: "Agreement comprehension & transaction mapping",
    max: 15,
    earned: ratioToPoints(mappingMatched, mappingSignals.length, 15),
    note: `Transaction elements discussed: ${mappingMatched}/${mappingSignals.length}.`,
  };

  // 2. Substantive issue spotting — 30 pts
  const issueMatches = matchedTopics(text, ISSUE_TOPICS);
  const coveragePoints = ratioToPoints(issueMatches.length, ISSUE_TOPICS.length, 24);
  const depthPoints = Math.min(6, turns);
  const issueSpotting: CompetencyResult = {
    id: "issues",
    label: "Substantive issue spotting",
    max: 30,
    earned: Math.min(30, coveragePoints + depthPoints),
    note: `${issueMatches.length}/${ISSUE_TOPICS.length} gating-issue areas raised in dialogue.`,
  };
  ISSUE_TOPICS.filter((topic) => !issueMatches.includes(topic)).forEach((topic) =>
    gaps.push(`Never raised ${topic.label.toLowerCase()} with the agent.`),
  );
  issueMatches
    .slice(0, 3)
    .forEach((topic) => strengths.push(`${topic.label} reasoned through in conversation.`));

  // 3. Risk prioritization & judgment — 15 pts
  const prioritizes = /high|medium|low|most critical|first|priorit|gating|threshold|blocker/.test(
    text,
  );
  const tiesNextStep = /next step|request|confirm|obtain|review|counsel|escalat/.test(text);
  const weighsMateriality = /material|deal-?breaker|cleanup|minor|not.*gating|goes to (approval|closing)/.test(
    text,
  );
  const prioritization: CompetencyResult = {
    id: "judgment",
    label: "Risk prioritization & judgment",
    max: 15,
    earned: Math.min(
      15,
      (prioritizes ? 6 : 0) + (tiesNextStep ? 5 : 0) + (weighsMateriality ? 4 : 0),
    ),
    note: prioritizes
      ? "Learner ranks issues by risk / priority."
      : "No clear prioritization of issues by risk.",
  };
  if (!prioritizes) {
    gaps.push("Rank the issues — which are gating vs. drafting cleanup?");
  }

  // 4. Diligence request quality — 15 pts
  const requestMatches = matchedTopics(text, REQUEST_TOPICS);
  const asksForDocs =
    /request|obtain|ask for|produce|provide|confirm|schedule|copy of|documentation/.test(text);
  const coveragePts = requestMatches.length * 2.5;
  const routingPts = REQUEST_ROLE_PATTERN.test(text) ? 3 : 0;
  const askPts = asksForDocs ? 2 : 0;
  const requestQuality: CompetencyResult = {
    id: "requests",
    label: "Diligence request quality",
    max: 15,
    earned: Math.min(15, Math.round(coveragePts + routingPts + askPts)),
    note: `${requestMatches.length}/${REQUEST_TOPICS.length} request categories discussed.`,
  };
  if (requestMatches.length < REQUEST_TOPICS.length) {
    gaps.push(
      `Discuss diligence requests across all ${REQUEST_TOPICS.length} categories (${requestMatches.length}/${REQUEST_TOPICS.length} so far).`,
    );
  }
  if (routingPts === 0 && asksForDocs) {
    gaps.push("Route requests to a source or specialist (regulatory counsel, tax, secretary).");
  }

  // 5. Associate-facing communication — 15 pts
  const summaryMatches = matchedTopics(text, SUMMARY_SIGNALS);
  const readinessAnswer = SUMMARY_SIGNALS[0].pattern.test(text);
  const communication: CompetencyResult = {
    id: "communication",
    label: "Readiness call & communication",
    max: 15,
    earned: Math.min(15, ratioToPoints(summaryMatches.length, SUMMARY_SIGNALS.length, 15)),
    note: readinessAnswer
      ? "Readiness conclusion stated."
      : "No clear signature-readiness conclusion yet.",
  };
  if (!readinessAnswer) {
    gaps.push("State plainly whether the agreement is ready for signature.");
  }

  // 6. Diligence process & thoroughness — 10 pts
  const engagement: CompetencyResult = {
    id: "process",
    label: "Diligence process & thoroughness",
    max: 10,
    earned: Math.min(10, Math.round((Math.min(turns, 8) / 8) * 7) + (turns >= 3 ? 3 : 0)),
    note: `${turns} substantive exchange${turns === 1 ? "" : "s"} with the agent.`,
  };
  if (turns < 4) {
    gaps.push("Work the case more thoroughly — press the agent across each workstream.");
  }

  const competencies = [
    comprehension,
    issueSpotting,
    prioritization,
    requestQuality,
    communication,
    engagement,
  ];

  const total = competencies.reduce((sum, competency) => sum + competency.earned, 0);

  const verdict: GradeVerdict =
    total >= DISTINCTION_SCORE
      ? "distinction"
      : total >= PASSING_SCORE
        ? "pass"
        : "developing";

  const headline =
    verdict === "distinction"
      ? "Distinction — you reasoned through this case like a supervising-associate-ready clerk."
      : verdict === "pass"
        ? "Passing — solid coverage with a few workstreams left to press on."
        : "Developing — keep working the case with the agent to cover the core issues.";

  if (strengths.length === 0) {
    strengths.push("Start reasoning through the case with the agent to earn credit.");
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
