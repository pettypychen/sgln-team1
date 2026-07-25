/**
 * Live coverage tracker for the AI-native workspace.
 *
 * Mirrors the old work-product readiness dashboard, but measures the case the
 * learner has *argued in conversation* instead of a typed artifact. The three
 * dimensions map onto the three graded steps, so the header counters and the
 * "Complete step" gate can read from one source of truth.
 */

import type { ChatMessage } from "@/types";
import {
  ISSUE_TOPICS,
  REQUEST_TOPICS,
  SUMMARY_SIGNALS,
  learnerText,
  matchedTopics,
  substantiveTurnCount,
} from "./caseRubric";
import type { WorkProductDeliverable } from "./workProductReadiness";

export type CoverageState = "Not started" | "In progress" | "Ready";

export interface CoverageDimension {
  id: WorkProductDeliverable;
  label: string;
  /** Distinct rubric areas the learner has touched in conversation. */
  count: number;
  /** Areas needed for this dimension to count as ready. */
  target: number;
  total: number;
  state: CoverageState;
  ready: boolean;
  message: string;
  /** Rubric areas not yet raised — used to steer the learner. */
  missing: string[];
}

export interface ConversationCoverage {
  issueLog: CoverageDimension;
  requestList: CoverageDimension;
  associateSummary: CoverageDimension;
  readyCount: number;
  allReady: boolean;
  /** Learner turns with real substance — an engagement floor. */
  turns: number;
}

const ISSUE_TARGET = 6;
const REQUEST_TARGET = 4;
const SUMMARY_TARGET = 3;
/** A dimension can only be "ready" once the learner has genuinely engaged. */
const MIN_TURNS_FOR_READY = 2;

function stateFor(count: number, target: number, turns: number): CoverageState {
  if (count === 0) {
    return "Not started";
  }
  if (count >= target && turns >= MIN_TURNS_FOR_READY) {
    return "Ready";
  }
  return "In progress";
}

function buildDimension(
  id: WorkProductDeliverable,
  label: string,
  matched: { label: string }[],
  allLabels: string[],
  target: number,
  turns: number,
  readyMessage: string,
): CoverageDimension {
  const count = matched.length;
  const state = stateFor(count, target, turns);
  const ready = state === "Ready";
  const matchedLabels = new Set(matched.map((topic) => topic.label));
  const missing = allLabels.filter((topicLabel) => !matchedLabels.has(topicLabel));

  let message: string;
  if (ready) {
    message = readyMessage;
  } else if (turns < MIN_TURNS_FOR_READY && count >= target) {
    message = "Keep reasoning with the agent to lock this in.";
  } else if (count === 0) {
    message = `Not raised yet — talk through ${label.toLowerCase()} with the agent.`;
  } else {
    const remaining = Math.max(1, target - count);
    message = `${count}/${target} areas so far — cover ${remaining} more with the agent.`;
  }

  return {
    id,
    label,
    count,
    target,
    total: allLabels.length,
    state,
    ready,
    message,
    missing,
  };
}

export function buildConversationCoverage(
  messages: ChatMessage[],
): ConversationCoverage {
  const text = learnerText(messages);
  const turns = substantiveTurnCount(messages);

  const issueLog = buildDimension(
    "issueLog",
    "Issues",
    matchedTopics(text, ISSUE_TOPICS),
    ISSUE_TOPICS.map((topic) => topic.label),
    ISSUE_TARGET,
    turns,
    "Gating issues are well covered.",
  );

  const requestList = buildDimension(
    "requestList",
    "Requests",
    matchedTopics(text, REQUEST_TOPICS),
    REQUEST_TOPICS.map((topic) => topic.label),
    REQUEST_TARGET,
    turns,
    "Diligence requests span every category.",
  );

  const associateSummary = buildDimension(
    "associateSummary",
    "Summary",
    matchedTopics(text, SUMMARY_SIGNALS),
    SUMMARY_SIGNALS.map((topic) => topic.label),
    SUMMARY_TARGET,
    turns,
    "Readiness call is complete.",
  );

  const dimensions = [issueLog, requestList, associateSummary];
  const readyCount = dimensions.filter((dimension) => dimension.ready).length;

  return {
    issueLog,
    requestList,
    associateSummary,
    readyCount,
    allReady: readyCount === dimensions.length,
    turns,
  };
}

export function coverageForStep(
  coverage: ConversationCoverage,
  deliverable: WorkProductDeliverable | undefined,
): CoverageDimension | undefined {
  if (!deliverable) {
    return undefined;
  }
  return coverage[deliverable];
}
