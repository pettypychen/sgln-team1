import type { TranscriptMessage } from "@/evaluation/types";
import type { ChatMessage } from "@/types";

const ATTEMPT_COUNT_KEY = (caseId: string) => `simworks:attempt-count:${caseId}`;

/** Returns the number of completed submissions for this case (0 if none yet). */
export function getSubmissionAttemptCount(caseId: string): number {
  const stored = window.localStorage.getItem(ATTEMPT_COUNT_KEY(caseId));
  return stored ? parseInt(stored, 10) : 0;
}

/** Increments the local attempt counter and returns the new value (1 on first submission). */
export function incrementSubmissionAttemptCount(caseId: string): number {
  const next = getSubmissionAttemptCount(caseId) + 1;
  window.localStorage.setItem(ATTEMPT_COUNT_KEY(caseId), String(next));
  return next;
}

/** Clears chat history and work product for a case so the next attempt starts fresh. */
export function clearSimulationProgress(caseId: string): void {
  window.localStorage.removeItem(`simworks:${caseId}`);
  window.sessionStorage.removeItem(`simworks:submission-key:${caseId}`);
}

interface StoredProgress {
  chatMessages?: ChatMessage[];
  messages?: TranscriptMessage[];
  workProduct?: string | Record<string, string>;
}

export function snapshotFromProgress(caseId: string) {
  const raw = window.localStorage.getItem(`simworks:${caseId}`);
  let progress: StoredProgress = {};
  try {
    progress = raw ? (JSON.parse(raw) as StoredProgress) : {};
  } catch {
    progress = {};
  }

  const chatMessages = progress.chatMessages ?? [];
  const transcript =
    progress.messages ??
    chatMessages.map((message, index) => ({
      id: message.id,
      role: message.role === "user" ? "learner" : "agent",
      content: message.content,
      status: message.status === "failed" ? "failed" : "sent",
      createdAt: new Date(
        Date.now() - (chatMessages.length - index) * 1000,
      ).toISOString(),
    }));
  const workProduct =
    typeof progress.workProduct === "string"
      ? progress.workProduct
      : Object.entries(progress.workProduct ?? {})
          .map(([label, content]) => `## ${label}\n\n${content}`)
          .join("\n\n");

  return { transcript, workProduct };
}
