import { addDoc, collection, getDocs, query, serverTimestamp, Timestamp, where } from "firebase/firestore";
import { db } from "./firebase";
import { getCaseDefinition, sourceArtifactsForCase } from "@/evaluation/rubrics";
import type { Attempt, AttemptStatus, EvaluationMode, EvaluationRun } from "@/evaluation/types";

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

  // Load submissions and evaluations in parallel; join by submissionId so the
  // queue table can show AI evaluation status and scores from the evaluations collection.
  const [submissionsSnap, evaluationsSnap] = await Promise.all([
    getDocs(collection(db, "submissions")),
    getDocs(collection(db, "evaluations")),
  ]);

  // Index the latest evaluation per submissionId (sorted by createdAt desc).
  type EvalEntry = {
    evaluationRuns: EvaluationRun[];
    status: string;
    review: Attempt["review"];
    createdAt: string;
  };
  const evalBySubmission = new Map<string, EvalEntry>();
  for (const doc of evaluationsSnap.docs) {
    const d = doc.data() as {
      submissionId: string;
      evaluationRuns: EvaluationRun[];
      status: string;
      review?: Attempt["review"];
      createdAt: string;
    };
    const existing = evalBySubmission.get(d.submissionId);
    if (!existing || String(d.createdAt ?? "") > String(existing.createdAt ?? "")) {
      evalBySubmission.set(d.submissionId, {
        evaluationRuns: d.evaluationRuns || [],
        status: d.status,
        review: d.review,
        createdAt: d.createdAt,
      });
    }
  }

  return submissionsSnap.docs.map((doc) => {
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
    const evalData = evalBySubmission.get(doc.id);
    let category = "";
    try { category = getCaseDefinition(d.caseId).category; } catch { /* unknown case */ }
    const submittedAt = d.submittedAt instanceof Timestamp
      ? d.submittedAt.toDate().toISOString()
      : new Date().toISOString();
    // Prefer the evaluation status (updated by the Cloud Function) over the
    // submission's initial evaluationStatus field.
    const status = ((evalData?.status || d.evaluationStatus) as AttemptStatus) ?? "pending_ai_processing";
    return {
      // Use Firestore doc ID as the row identity — unique per submission document
      // regardless of whether multiple docs share the same attemptId.
      id: doc.id,
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
      status,
      evaluationRuns: evalData?.evaluationRuns ?? [],
      review: evalData?.review,
    } satisfies Attempt;
  });
}

/**
 * Loads the latest evaluation record for a given submission doc ID.
 * Queries the evaluations collection by submissionId and returns the result
 * mapped to the Attempt shape so EvaluatorReviewPage can render it directly.
 */
export async function getEvaluationForSubmission(submissionId: string): Promise<Attempt | null> {
  if (!db) return null;
  const q = query(
    collection(db, "evaluations"),
    where("submissionId", "==", submissionId),
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;

  // Sort in memory by createdAt desc; avoids requiring a composite Firestore index.
  const sorted = [...snapshot.docs].sort((a, b) =>
    String(b.data().createdAt ?? "").localeCompare(String(a.data().createdAt ?? "")),
  );
  const doc = sorted[0];
  const d = doc.data() as {
    displayName: string;
    caseId: string;
    caseTitle: string;
    category: string;
    workProduct: string;
    attemptNumber: number;
    submittedAt: string;
    status: string;
    evaluationRuns: EvaluationRun[];
    review?: Attempt["review"];
    createdAt: string;
  };

  let caseVersion = "";
  let rubricVersion = "";
  let evaluationMode: EvaluationMode = "human_final";
  let sourceArtifacts: Array<{ id: string; version: string }> = [];
  try {
    const def = getCaseDefinition(d.caseId);
    caseVersion = def.version;
    rubricVersion = def.rubric.rubricVersion;
    evaluationMode = def.evaluationMode;
    sourceArtifacts = sourceArtifactsForCase(d.caseId);
  } catch { /* unknown case — leave defaults */ }

  return {
    id: doc.id,
    participantId: "",
    learnerDisplayName: d.displayName || "",
    caseId: d.caseId || "",
    caseTitle: d.caseTitle || "",
    category: d.category || "",
    caseVersion,
    rubricVersion,
    evaluationMode,
    attemptNumber: d.attemptNumber ?? 1,
    transcript: [],
    workProduct: d.workProduct || "",
    sourceArtifacts,
    submissionMetadata: {
      messageCount: 0,
      learnerMessageCount: 0,
      agentMessageCount: 0,
      failedMessageCount: 0,
      workProductCharacterCount: (d.workProduct || "").length,
      sourceArtifactCount: sourceArtifacts.length,
    },
    submittedAt: d.submittedAt || new Date().toISOString(),
    idempotencyKey: "",
    status: (d.status as AttemptStatus) ?? "ready_for_review",
    evaluationRuns: d.evaluationRuns || [],
    review: d.review,
  } satisfies Attempt;
}
