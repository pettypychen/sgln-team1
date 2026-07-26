import { latestCompletedEvaluation } from "./domain";
import type { Attempt } from "./types";

const STORAGE_KEY = "simworks:evaluator-queue-filters";

export interface QueueFilters {
  caseId: string;
  status: string;
  recommendation: string;
  attemptNumber: string;
  submittedWithinDays: string;
}

export const DEFAULT_QUEUE_FILTERS: QueueFilters = {
  caseId: "all",
  status: "all",
  recommendation: "all",
  attemptNumber: "all",
  submittedWithinDays: "all",
};

export function readQueueFilters(): QueueFilters {
  if (typeof window === "undefined") return DEFAULT_QUEUE_FILTERS;
  try {
    const parsed = JSON.parse(
      window.sessionStorage.getItem(STORAGE_KEY) || "{}",
    ) as Partial<QueueFilters>;
    return { ...DEFAULT_QUEUE_FILTERS, ...parsed };
  } catch {
    return DEFAULT_QUEUE_FILTERS;
  }
}

export function writeQueueFilters(filters: QueueFilters) {
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
}

export function filterQueueAttempts(
  attempts: Attempt[],
  filters: QueueFilters,
  currentTime = Date.now(),
) {
  return attempts
    .filter(
      (attempt) =>
        filters.caseId === "all" || attempt.caseId === filters.caseId,
    )
    .filter(
      (attempt) =>
        filters.status === "all" || attempt.status === filters.status,
    )
    .filter(
      (attempt) =>
        filters.recommendation === "all" ||
        latestCompletedEvaluation(attempt)?.recommendation ===
          filters.recommendation,
    )
    .filter(
      (attempt) =>
        filters.attemptNumber === "all" ||
        String(attempt.attemptNumber) === filters.attemptNumber,
    )
    .filter((attempt) => {
      if (filters.submittedWithinDays === "all") return true;
      const cutoff =
        currentTime -
        Number(filters.submittedWithinDays) * 24 * 60 * 60 * 1000;
      return new Date(attempt.submittedAt).getTime() >= cutoff;
    })
    .sort((left, right) => {
      const leftReady = left.status === "ready_for_review" ? 0 : 1;
      const rightReady = right.status === "ready_for_review" ? 0 : 1;
      return (
        leftReady - rightReady ||
        left.submittedAt.localeCompare(right.submittedAt)
      );
    });
}
