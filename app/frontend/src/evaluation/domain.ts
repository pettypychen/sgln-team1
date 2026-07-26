import { getCaseDefinition } from "./rubrics";
import type {
  Attempt,
  CriterionAssessment,
  HumanCriterionScore,
  ReviewDraftInput,
  SharedOutcome,
} from "./types";

export interface ScoreSummary {
  caseScore: number;
  interactionScore: number;
  casePassed: boolean;
  interactionPassed: boolean;
  criticalFailure: boolean;
  outcome: SharedOutcome;
}

export function scoreReview(
  caseId: string,
  scores: HumanCriterionScore[],
): ScoreSummary {
  const definition = getCaseDefinition(caseId);
  const byId = new Map(scores.map((score) => [score.criterionId, score]));
  let caseScore = 0;
  let interactionScore = 0;
  let criticalFailure = false;

  for (const item of definition.rubric.criteria) {
    const score = byId.get(item.id)?.points ?? 0;
    const safeScore = Math.max(0, Math.min(item.maxPoints, score));
    if (item.dimension === "case_outcome") caseScore += safeScore;
    else interactionScore += safeScore;
    if (item.criticalFailure && safeScore === 0) criticalFailure = true;
  }

  const casePassed = caseScore >= definition.rubric.caseThreshold;
  const interactionPassed =
    interactionScore >= definition.rubric.interactionThreshold;
  const outcome: SharedOutcome =
    casePassed && interactionPassed && !criticalFailure
      ? "pass"
      : casePassed || interactionPassed
        ? "remediation_required"
        : "not_yet_ready";

  return {
    caseScore,
    interactionScore,
    casePassed,
    interactionPassed,
    criticalFailure,
    outcome,
  };
}

export function latestCompletedAssessments(
  attempt: Attempt,
): CriterionAssessment[] {
  return latestCompletedEvaluation(attempt)?.assessments ?? [];
}

export function latestCompletedEvaluation(attempt: Attempt) {
  return [...attempt.evaluationRuns]
    .reverse()
    .find((run) => run.status === "completed");
}

export function recommendedOutcome(attempt: Attempt): SharedOutcome {
  return latestCompletedEvaluation(attempt)?.recommendation ?? "not_yet_ready";
}

export function initialHumanScores(attempt: Attempt): HumanCriterionScore[] {
  const assessmentById = new Map(
    latestCompletedAssessments(attempt).map((item) => [item.criterionId, item]),
  );
  return getCaseDefinition(attempt.caseId).rubric.criteria.map((item) => ({
    criterionId: item.id,
    points: assessmentById.get(item.id)?.points ?? 0,
    note: "",
    overrideReason: "",
  }));
}

export function validateReview(
  attempt: Attempt,
  draft: ReviewDraftInput,
): string[] {
  const errors: string[] = [];
  const definition = getCaseDefinition(attempt.caseId);
  const assessments = new Map(
    latestCompletedAssessments(attempt).map((item) => [item.criterionId, item]),
  );
  const scoreById = new Map(draft.scores.map((item) => [item.criterionId, item]));

  for (const criterion of definition.rubric.criteria) {
    const score = scoreById.get(criterion.id);
    if (!score || !Number.isFinite(score.points)) {
      errors.push(`${criterion.label}: a human score is required.`);
      continue;
    }
    if (score.points < 0 || score.points > criterion.maxPoints) {
      errors.push(`${criterion.label}: score must be 0–${criterion.maxPoints}.`);
    }
    const aiPoints = assessments.get(criterion.id)?.points;
    if (aiPoints !== undefined && aiPoints !== score.points && !score.overrideReason.trim()) {
      errors.push(`${criterion.label}: explain why the AI score was changed.`);
    }
  }

  const calculated = scoreReview(attempt.caseId, draft.scores).outcome;
  if (calculated !== draft.outcome && !draft.outcomeOverrideReason.trim()) {
    errors.push("Explain why the calculated outcome was overridden.");
  }
  if (!draft.summary.trim()) errors.push("Evaluator summary is required.");
  return errors;
}

export function latestEvaluation(attempt: Attempt) {
  return attempt.evaluationRuns[attempt.evaluationRuns.length - 1];
}

export function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function outcomeLabel(outcome: SharedOutcome): string {
  if (outcome === "pass") return "Pass";
  if (outcome === "remediation_required") return "Remediation required";
  return "Not yet ready";
}

export function isFinalStatus(status: Attempt["status"]): boolean {
  return (
    status === "pass" ||
    status === "remediation_required" ||
    status === "not_yet_ready"
  );
}
