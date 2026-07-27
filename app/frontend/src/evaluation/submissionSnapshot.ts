import type { TranscriptMessage } from "@/evaluation/types";
import type { ChatMessage } from "@/types";

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
