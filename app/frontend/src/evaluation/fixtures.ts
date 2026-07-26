import { getCaseDefinition, sourceArtifactsForCase } from "./rubrics";
import type {
  Attempt,
  CriterionAssessment,
  EvaluationRun,
  SharedOutcome,
} from "./types";

const NOW = new Date("2026-07-26T06:00:00.000Z");

function iso(hoursAgo: number) {
  return new Date(NOW.getTime() - hoursAgo * 3_600_000).toISOString();
}

function assessmentFor(
  caseId: string,
  index: number,
  scale: number,
): CriterionAssessment {
  const item = getCaseDefinition(caseId).rubric.criteria[index];
  const points = Math.round(item.maxPoints * scale);
  return {
    criterionId: item.id,
    points,
    explanation: `${item.label} is ${scale >= 0.75 ? "well supported" : "partially supported"} by the submitted work.`,
    supported: index !== 1 || scale >= 0.5,
    evidence: [
      {
        id: `${caseId}-evidence-${index}`,
        messageId: `${caseId}-learner-1`,
        excerpt: "I checked the source artifact and separated verified facts from assumptions.",
        source: {
          artifactId: sourceArtifactsForCase(caseId)[0].id,
          locator: `item ${index + 1}`,
        },
        connection: `This supports the ${item.label.toLowerCase()} criterion.`,
        resolved: index !== 1 || scale >= 0.5,
      },
    ],
  };
}

function runFor(
  attemptId: string,
  caseId: string,
  outcome: SharedOutcome,
  failed = false,
): EvaluationRun {
  const definition = getCaseDefinition(caseId);
  const scale =
    outcome === "pass" ? 0.86 : outcome === "remediation_required" ? 0.62 : 0.32;
  const assessments = failed
    ? []
    : definition.rubric.criteria.map((_, index) =>
        assessmentFor(caseId, index, scale),
      );
  const total = (dimension: "case_outcome" | "ai_interaction") =>
    assessments
      .filter((item) =>
        definition.rubric.criteria.find(
          (criterion) =>
            criterion.id === item.criterionId &&
            criterion.dimension === dimension,
        ),
      )
      .reduce((sum, item) => sum + item.points, 0);
  return {
    id: `run-${attemptId}-1`,
    attemptId,
    provider: "fixture",
    model: "simworks-evaluator-fixture",
    promptVersion: "1.0.0",
    caseVersion: definition.version,
    rubricVersion: definition.rubric.rubricVersion,
    startedAt: iso(5),
    completedAt: iso(4.9),
    status: failed ? "failed" : "completed",
    assessments,
    caseScore: total("case_outcome"),
    interactionScore: total("ai_interaction"),
    recommendation: failed ? undefined : outcome,
    validationErrors: failed ? ["Fixture provider unavailable."] : [],
  };
}

function attempt(
  id: string,
  learnerDisplayName: string,
  caseId: string,
  status: Attempt["status"],
  outcome: SharedOutcome,
  hoursAgo: number,
  attemptNumber = 1,
  predecessorAttemptId?: string,
): Attempt {
  const definition = getCaseDefinition(caseId);
  const failed = status === "ai_failed";
  const review =
    status === "pass" ||
    status === "remediation_required" ||
    status === "not_yet_ready"
      ? {
          version: 1,
          status: "final" as const,
          evaluatorName: "Jordan Lee",
          scores: definition.rubric.criteria.map((item, index) => ({
            criterionId: item.id,
            points: runFor(id, caseId, outcome).assessments[index]?.points ?? 0,
            note: "",
            overrideReason: "",
          })),
          summary: "Clear professional effort with focused next steps.",
          outcome,
          outcomeOverrideReason: "",
          savedAt: iso(hoursAgo - 1),
          finalizedAt: iso(hoursAgo - 1),
        }
      : undefined;
  return {
    id,
    participantId: `participant-${learnerDisplayName.toLowerCase().replace(/\s/g, "-")}`,
    learnerDisplayName,
    caseId,
    caseTitle: definition.title,
    category: definition.category,
    caseVersion: definition.version,
    rubricVersion: definition.rubric.rubricVersion,
    evaluationMode: "human_final",
    attemptNumber,
    predecessorAttemptId,
    transcript: [
      {
        id: `${caseId}-agent-1`,
        role: "agent",
        content: "What evidence should we verify before reaching a conclusion?",
        status: "sent",
        createdAt: iso(hoursAgo + 0.4),
      },
      {
        id: `${caseId}-learner-1`,
        role: "learner",
        content:
          "I checked the source artifact and separated verified facts from assumptions.",
        status: "sent",
        createdAt: iso(hoursAgo + 0.2),
      },
    ],
    workProduct: "Fixture work product with source-backed findings and next actions.",
    sourceArtifacts: sourceArtifactsForCase(caseId),
    submissionMetadata: {
      messageCount: 2,
      learnerMessageCount: 1,
      agentMessageCount: 1,
      failedMessageCount: 0,
      workProductCharacterCount: 66,
      sourceArtifactCount: sourceArtifactsForCase(caseId).length,
      firstInteractionAt: iso(hoursAgo + 0.4),
      lastInteractionAt: iso(hoursAgo + 0.2),
    },
    submittedAt: iso(hoursAgo),
    idempotencyKey: `fixture-${id}`,
    status,
    evaluationRuns: [runFor(id, caseId, outcome, failed)],
    review,
  };
}

export const SEEDED_ATTEMPTS: Attempt[] = [
  attempt("att-legal-001", "Aisha Rahman", "first-year-associate-ma-due-diligence", "ready_for_review", "pass", 30),
  attempt("att-close-001", "Marcus Tan", "month-end-close-under-pressure", "ai_failed", "not_yet_ready", 26),
  attempt("att-ba-001", "Priya Nair", "requirements-gathering-workshop", "in_review", "remediation_required", 22),
  attempt("att-legal-002", "Noah Lim", "first-year-associate-ma-due-diligence", "pass", "pass", 18),
  attempt("att-close-002", "Siti Hawa", "month-end-close-under-pressure", "remediation_required", "remediation_required", 14),
  attempt("att-ba-002", "Ethan Wong", "requirements-gathering-workshop", "not_yet_ready", "not_yet_ready", 10),
  attempt("att-kopi-001", "Mei Chen", "kopi-run", "ready_for_review", "pass", 8),
  attempt("att-legal-003", "Siti Hawa", "first-year-associate-ma-due-diligence", "ready_for_review", "pass", 4, 2, "att-close-002"),
];
