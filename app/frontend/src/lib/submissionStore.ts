import { addDoc, collection, getDocs, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "./firebase";
import { getCaseDefinition } from "@/evaluation/rubrics";
import type { Attempt, AttemptStatus } from "@/evaluation/types";

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

/** Reads all submission records from Firestore and maps them to the Attempt shape. */
export async function listSubmissions(): Promise<Attempt[]> {
  if (!db) return [];
  const snapshot = await getDocs(collection(db, "submissions"));
  const seen = new Set<string>();
  return snapshot.docs.flatMap((doc) => {
    const d = doc.data() as {
      displayName: string;
      caseId: string;
      caseTitle: string;
      workProduct: string;
      evaluationStatus: string;
      attemptId: string;
      attemptNumber: number;
      submittedAt: Timestamp | null;
    };
    // Use Firestore doc ID as fallback when attemptId is absent (legacy docs).
    // Deduplicate by attemptId to handle retried addDoc writes for the same attempt.
    const rowId = d.attemptId || doc.id;
    if (seen.has(rowId)) return [];
    seen.add(rowId);
    let category = "";
    try { category = getCaseDefinition(d.caseId).category; } catch { /* unknown case */ }
    const submittedAt = d.submittedAt instanceof Timestamp
      ? d.submittedAt.toDate().toISOString()
      : new Date().toISOString();
    return [{
      id: rowId,
      participantId: "",
      learnerDisplayName: d.displayName,
      caseId: d.caseId,
      caseTitle: d.caseTitle,
      category,
      caseVersion: "",
      rubricVersion: "",
      evaluationMode: "human_final" as const,
      attemptNumber: d.attemptNumber,
      transcript: [],
      workProduct: d.workProduct,
      sourceArtifacts: [],
      submissionMetadata: {
        messageCount: 0,
        learnerMessageCount: 0,
        agentMessageCount: 0,
        failedMessageCount: 0,
        workProductCharacterCount: d.workProduct?.length ?? 0,
        sourceArtifactCount: 0,
      },
      submittedAt,
      idempotencyKey: "",
      status: (d.evaluationStatus as AttemptStatus) ?? "pending_ai_processing",
      evaluationRuns: [],
    } satisfies Attempt];
  });
}
