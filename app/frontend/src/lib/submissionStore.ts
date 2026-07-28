import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export interface SubmissionRecord {
  displayName: string;
  email: string;
  caseId: string;
  caseTitle: string;
  workProduct: string;
  evaluationStatus: "pending_ai_processing";
  attemptId: string;
  attemptNumber: number;
}

/** Persists a submission record to Firestore. No-ops if Firebase is unconfigured (local dev). */
export async function saveSubmission(record: SubmissionRecord): Promise<void> {
  if (!db) return;
  await addDoc(collection(db, "submissions"), {
    ...record,
    submittedAt: serverTimestamp(),
  });
}
