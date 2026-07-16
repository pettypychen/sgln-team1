import type { WorkProductDraft } from "@/types";

export type WorkProductDeliverable =
  | "issueLog"
  | "requestList"
  | "associateSummary";

export type WorkProductState = "Not started" | "Needs work" | "Ready";

export interface DeliverableReadiness {
  id: WorkProductDeliverable;
  label: string;
  requirement: string;
  count: number;
  countLabel: string;
  state: WorkProductState;
  ready: boolean;
  message: string;
}

export interface WorkProductReadiness {
  issueLog: DeliverableReadiness;
  requestList: DeliverableReadiness;
  associateSummary: DeliverableReadiness;
  readyCount: number;
  allReady: boolean;
}

export function countIssueRows(value: string) {
  return value
    .split("\n")
    .filter((line) => {
      const normalized = line.trim();
      return (
        normalized.startsWith("|") &&
        !normalized.includes("---") &&
        !normalized.toLowerCase().includes("section | issue")
      );
    }).length;
}

export function countRequests(value: string) {
  return value
    .split("\n")
    .filter((line) => /^[-*]\s+\S/.test(line.trim())).length;
}

export function countWords(value: string) {
  const words = value.trim().match(/\S+/g);
  return words?.length ?? 0;
}

function stateForMinimum(count: number, minimum: number): WorkProductState {
  if (count >= minimum) {
    return "Ready";
  }

  return count === 0 ? "Not started" : "Needs work";
}

export function buildWorkProductReadiness(
  draft: WorkProductDraft,
): WorkProductReadiness {
  const issueCount = countIssueRows(draft.issueLog);
  const requestCount = countRequests(draft.requestList);
  const summaryWords = countWords(draft.associateSummary);

  const issueState = stateForMinimum(issueCount, 12);
  const requestState = stateForMinimum(requestCount, 10);
  const summaryReady = summaryWords >= 1 && summaryWords <= 350;
  const summaryState: WorkProductState = summaryReady
    ? "Ready"
    : summaryWords === 0
      ? "Not started"
      : "Needs work";

  const issueLog: DeliverableReadiness = {
    id: "issueLog",
    label: "Issue log",
    requirement: "Requires 12 issue rows",
    count: issueCount,
    countLabel: `${issueCount} issue ${issueCount === 1 ? "row" : "rows"}`,
    state: issueState,
    ready: issueState === "Ready",
    message:
      issueState === "Ready"
        ? "Issue log is ready for evaluation."
        : `Add ${12 - issueCount} more issue ${
            12 - issueCount === 1 ? "row" : "rows"
          } before evaluation.`,
  };

  const requestList: DeliverableReadiness = {
    id: "requestList",
    label: "Requests",
    requirement: "Requires 10 requests",
    count: requestCount,
    countLabel: `${requestCount} ${requestCount === 1 ? "request" : "requests"}`,
    state: requestState,
    ready: requestState === "Ready",
    message:
      requestState === "Ready"
        ? "Request list is ready for evaluation."
        : `Add ${10 - requestCount} more ${
            10 - requestCount === 1 ? "request" : "requests"
          } before evaluation.`,
  };

  const associateSummary: DeliverableReadiness = {
    id: "associateSummary",
    label: "Summary",
    requirement: "Requires 1-350 words",
    count: summaryWords,
    countLabel: `${summaryWords} ${summaryWords === 1 ? "word" : "words"}`,
    state: summaryState,
    ready: summaryReady,
    message: summaryReady
      ? "Associate summary is ready for evaluation."
      : summaryWords > 350
        ? `Trim ${summaryWords - 350} ${
            summaryWords - 350 === 1 ? "word" : "words"
          } to stay under 350 before evaluation.`
        : "Write a 1-350 word associate summary before evaluation.",
  };

  const deliverables = [issueLog, requestList, associateSummary];
  const readyCount = deliverables.filter((deliverable) => deliverable.ready).length;

  return {
    issueLog,
    requestList,
    associateSummary,
    readyCount,
    allReady: readyCount === deliverables.length,
  };
}

export function deliverableForStep(
  stepId: string,
): WorkProductDeliverable | undefined {
  if (stepId === "identify-issues") {
    return "issueLog";
  }

  if (stepId === "draft-requests") {
    return "requestList";
  }

  if (stepId === "final-check") {
    return "associateSummary";
  }

  return undefined;
}
