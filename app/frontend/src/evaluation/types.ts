export type EvaluationMode =
  | "human_final"
  | "human_confirmation"
  | "ai_final_audited";

export type SharedOutcome =
  | "pass"
  | "remediation_required"
  | "not_yet_ready";

export type AttemptStatus =
  | "pending_ai_processing"
  | "ai_processing"
  | "ready_for_review"
  | "ai_failed"
  | "in_review"
  | SharedOutcome;

export type Dimension = "case_outcome" | "ai_interaction";

export interface RubricCriterion {
  id: string;
  dimension: Dimension;
  label: string;
  description: string;
  maxPoints: number;
  criticalFailure?: boolean;
}

export interface RubricDefinition {
  caseId: string;
  caseVersion: string;
  rubricVersion: string;
  caseThreshold: number;
  interactionThreshold: number;
  criteria: RubricCriterion[];
}

export interface CaseDefinition {
  id: string;
  title: string;
  category: string;
  version: string;
  evaluationMode: EvaluationMode;
  rubric: RubricDefinition;
  released: boolean;
  badge: {
    symbol: string;
    name: string;
    palette: string;
  };
  /** Label for the work-product panel on the submission page. Defaults to "Your submission". */
  submissionTitle?: string;
  /** Placeholder text for the work-product textarea. Defaults to a generic prompt. */
  workProductPlaceholder?: string;
}

export interface TranscriptMessage {
  id: string;
  role: "learner" | "agent";
  content: string;
  status: "sent" | "failed";
  createdAt: string;
}

export interface EvidenceCitation {
  id: string;
  messageId?: string;
  excerpt: string;
  source?: {
    artifactId: string;
    locator: string;
  };
  connection: string;
  resolved: boolean;
}

export interface CriterionAssessment {
  criterionId: string;
  points: number;
  explanation: string;
  evidence: EvidenceCitation[];
  supported: boolean;
}

export interface EvaluationRun {
  id: string;
  attemptId: string;
  parentRunId?: string;
  provider: string;
  model: string;
  promptVersion: string;
  caseVersion: string;
  rubricVersion: string;
  startedAt: string;
  completedAt?: string;
  status: "processing" | "completed" | "failed" | "invalid";
  assessments: CriterionAssessment[];
  caseScore: number;
  interactionScore: number;
  recommendation?: SharedOutcome;
  validationErrors: string[];
}

export interface SubmissionMetadata {
  messageCount: number;
  learnerMessageCount: number;
  agentMessageCount: number;
  failedMessageCount: number;
  workProductCharacterCount: number;
  sourceArtifactCount: number;
  firstInteractionAt?: string;
  lastInteractionAt?: string;
}

export interface ReviewClaim {
  evaluatorName: string;
  claimedAt: string;
  expiresAt: string;
  takeoverHistory: Array<{
    from: string;
    to: string;
    at: string;
  }>;
}

export interface HumanCriterionScore {
  criterionId: string;
  points: number;
  note: string;
  overrideReason: string;
  overriddenBy?: string;
  overriddenAt?: string;
}

export interface HumanReview {
  version: number;
  status: "draft" | "final";
  evaluatorName: string;
  scores: HumanCriterionScore[];
  summary: string;
  outcome: SharedOutcome;
  outcomeOverrideReason: string;
  supplementalLabel?: string;
  savedAt: string;
  finalizedAt?: string;
}

export interface Attempt {
  id: string;
  participantId: string;
  learnerDisplayName: string;
  caseId: string;
  caseTitle: string;
  category: string;
  caseVersion: string;
  rubricVersion: string;
  evaluationMode: EvaluationMode;
  attemptNumber: number;
  predecessorAttemptId?: string;
  transcript: TranscriptMessage[];
  workProduct: string;
  sourceArtifacts: Array<{ id: string; version: string }>;
  submissionMetadata: SubmissionMetadata;
  submittedAt: string;
  idempotencyKey: string;
  status: AttemptStatus;
  evaluationRuns: EvaluationRun[];
  claim?: ReviewClaim;
  review?: HumanReview;
}

export interface Credential {
  id: string;
  attemptId: string;
  participantId: string;
  learnerDisplayName: string;
  caseId: string;
  caseTitle: string;
  category: string;
  caseVersion: string;
  rubricVersion: string;
  attemptNumber: number;
  awardDate: string;
  issuer: "SimWorks";
  evaluationAuthority: "Human verified with AI-assisted scoring";
  supplementalLabel?: string;
  status: "private" | "public" | "revoked";
  publicToken?: string;
}

export type PublicCredential = Pick<
  Credential,
  | "id"
  | "learnerDisplayName"
  | "caseId"
  | "caseTitle"
  | "category"
  | "awardDate"
  | "issuer"
  | "evaluationAuthority"
  | "supplementalLabel"
  | "status"
>;

export interface NotificationRecord {
  id: string;
  kind: "submission_receipt" | "result";
  attemptId: string;
  reviewVersion?: number;
  status: "queued" | "sent" | "failed";
  createdAt: string;
}

export interface LearnerAccess {
  participantId: string;
  displayName: string;
  email: string;
  privateToken: string;
}

export interface ReviewDraftInput {
  scores: HumanCriterionScore[];
  summary: string;
  outcome: SharedOutcome;
  outcomeOverrideReason: string;
  supplementalLabel?: string;
}

export interface SubmitAttemptInput {
  displayName: string;
  email: string;
  participantId: string;
  caseId: string;
  transcript: TranscriptMessage[];
  workProduct: string;
  idempotencyKey: string;
  predecessorAttemptId?: string;
}

export interface FinalizeResult {
  attempt: Attempt;
  credential?: Credential;
  notification: NotificationRecord;
}
