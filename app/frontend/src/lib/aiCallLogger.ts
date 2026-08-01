import { addDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function logChatAiCall({
  userName,
  provider,
  aiModel,
  promptPreview,
  response,
}: {
  userName: string;
  provider: string;
  aiModel: string;
  promptPreview: string;
  response: string;
}): Promise<void> {
  if (!db) return;
  const now = new Date().toISOString();
  try {
    await addDoc(collection(db, "aiCallLogs"), {
      callType: "chat",
      submissionId: "",
      userName,
      provider,
      aiModel,
      promptPreview: promptPreview.slice(0, 1500),
      status: "complete",
      response: response.slice(0, 2000),
      datetime: now,
      completedAt: now,
    });
  } catch {
    // Non-blocking — logging must never break the chat
  }
}
