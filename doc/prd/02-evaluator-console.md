# PRD 02: Evaluator Console

Status: Draft for prototype implementation  
Parent: [Evaluation and Credentials Program](./00-evaluation-credentials-program.md)  
Depends on: [Submission and Evaluation Pipeline](./01-submission-evaluation-pipeline.md)

## Outcome

An evaluator can work through all submitted attempts from one queue, use an evidence-linked AI score as a copilot, save a review draft explicitly, and finalize a defensible learner outcome.

## Routes

- `/eval/all-cases`: evaluator queue.
- `/eval/all-cases/:attemptId`: dedicated review view.

Both routes require a valid prototype evaluator session.

## Prototype evaluator access

On first access:

1. Ask for the environment-configured evaluator access code.
2. Validate the code on the server.
3. Ask for the evaluator's display name.
4. Create a time-bounded evaluator session.

Record the entered display name on claims, saved drafts, takeovers, overrides, and final decisions. Label this as unverified prototype attribution.

Do not put the evaluator access code or its comparison logic in frontend source.

## Queue model

Each queue row represents one immutable attempt.

### Summary

Show:

- Awaiting review.
- In review.
- AI evaluation failed.
- Pass.
- Remediation required.
- Not yet ready.

These metrics are evaluator-only. A public Live Results feature is out of scope.

### Filters

Provide:

- Case.
- Review status.
- AI recommendation.
- Submission date.
- Attempt number.

Default ordering is oldest ready submission first. Preserve filter state when an evaluator returns from a review.

### Row content

Every row shows:

- Learner display name.
- Case title and category.
- Submission timestamp.
- Attempt number.
- AI evaluation status.
- AI case score and threshold result, when available.
- AI-interaction score and threshold result, when available.
- AI recommended outcome.
- Human-review status.
- Current review claimant, when present.

The queue must remain usable when an AI score is missing or invalid.

### Frontend mock stage

Build the queue and review UI first against a repository interface with seeded attempts for:

- First-Year Associate: M&A Due Diligence.
- Month-End Close Under Pressure.
- Requirements Gathering Workshop.

Add Kopi Run fixtures before prototype release. The release implementation replaces the seeded repository with shared persistence without changing page components or hardcoding rubric names.

## Review view

Use a desktop two-pane layout:

- Evidence pane: learner and agent transcript, source references, attempt history.
- Scoring pane: AI recommendation, case-defined rubric, human edits, notes, and final action.

On smaller screens, stack the evidence and scoring panes with a persistent way to switch between them.

### Attempt header

Show:

- Learner display name.
- Case, category, case version, and rubric version.
- Attempt number and predecessor link.
- Submission time.
- AI run status and version metadata.
- Review claimant and claim expiry.

Do not show the learner's email in the normal review interface.

### AI score is visible

The evaluator sees the AI assessment before scoring. This is intentional because the product uses a copilot model, and each case author supplies the evaluation guidance.

For every criterion show:

- Criterion label and maximum points.
- AI-awarded points.
- AI explanation.
- Evidence citations.
- Support status.
- Human-awarded points.
- Human note or override reason.

Totals and case-defined threshold outcomes recalculate as the evaluator edits scores.

### Evidence navigation

Selecting a citation must:

- Jump to and highlight the referenced transcript message.
- Show the quoted excerpt.
- Open the matching document page, CSV row, cell, or source item when relevant.
- Explain how the evidence maps to the rubric rule.

Broken or missing citations are visible errors. The UI must not present them as verified evidence.

### Criterion overrides

The evaluator can accept or edit every criterion score.

When a human score differs from the AI score:

- Require a short reason.
- Preserve the original AI score and explanation.
- Record the evaluator name and timestamp.
- Recalculate the totals.

### Final outcome override

The scoring rules calculate a recommended shared outcome. The evaluator may override it only with an additional explanation.

Shared outcomes:

- Pass.
- Remediation required.
- Not yet ready.

Case labels such as Distinction may be shown as supplemental labels. They do not replace the shared workflow outcome.

## Review claims

Opening an editable review creates a temporary claim.

- One evaluator may edit at a time.
- Other evaluators may view the attempt read-only.
- Default expiry is 15 minutes after inactivity.
- Active editors renew the claim while working.
- Another evaluator may take over after confirmation.
- Every takeover records both evaluator names and a timestamp.
- Leaving the review releases the claim when safe.

Finalized reviews are read-only. Reopening requires an administrative action and a recorded reason. The administrative mechanism may be implemented after the basic prototype, but direct editing of finalized records is never allowed.

## Save and finalize

Do not autosave.

### Save draft

Save draft:

- Persists human scores, notes, and override reasons.
- Does not release a result.
- Does not send email.
- Does not issue a badge.
- Keeps the attempt in review.

Warn before navigation when local changes differ from the last saved draft.

### Finalize evaluation

Finalize evaluation:

1. Validate all required scores and reasons.
2. Show a confirmation summary.
3. Save an immutable final human assessment.
4. Change the attempt to its final outcome.
5. Trigger exactly one outcome email.
6. Issue exactly one credential only for Pass.
7. Release the review claim.
8. Return the evaluator to the next oldest ready attempt while preserving filters.

The operation must be idempotent.

## AI evaluation failures

When AI evaluation fails:

- Show the attempt in the queue with a clear failure state.
- Allow an authorized retry.
- Preserve every run.
- Allow the evaluator to score manually from the rubric.
- Do not block finalization solely because AI failed.

## Attempt comparison

For attempts created through remediation:

- Link to earlier attempts.
- Show prior final outcome and feedback.
- Allow side-by-side or quick-switch comparison.
- Score the current attempt independently.

Do not merge transcripts or carry earlier scores into the new attempt.

## Accessibility and interaction requirements

- All scoring controls work by keyboard.
- Every form control has a programmatic label.
- Status cannot depend on colour alone.
- Evidence highlights move focus to the cited content.
- Claim expiry and unsaved-change warnings use live regions where appropriate.
- Finalization confirmation returns focus predictably.
- Queue tables provide a usable card fallback on narrow screens.

## Empty, loading, and error states

Cover:

- No submitted attempts.
- No attempts matching filters.
- Queue fetch failure.
- Attempt removed from current filter after another evaluator finalizes it.
- Review claim lost.
- Draft save conflict.
- Invalid rubric.
- Broken evidence citation.
- Finalization failure with safe retry.

## Acceptance criteria

- `/eval/all-cases` shows one row per attempt, including retries.
- Queue summary and filters use shared data, not browser-local learner state.
- Selecting a row opens its stable detail URL.
- AI criteria render from case rubric data with no hardcoded competency names.
- Every evidence citation jumps to a resolvable source or displays an error.
- Editing an AI score requires a reason before save or finalization.
- Overriding the recommended outcome requires a separate reason.
- Save draft persists without emailing or issuing a badge.
- Finalize sends one email and issues a badge only for Pass.
- Two evaluator sessions cannot edit one attempt simultaneously.
- A confirmed takeover is recorded.
- AI-evaluation failure does not block manual finalization.
- Unsaved edits trigger a navigation warning.

## Evaluator-only reporting

Track and display:

- Pending and completed reviews.
- Outcome counts by case.
- AI versus human outcome agreement.
- Criterion override rates.
- Median review time.
- Evaluation failure rate.

Do not expose these metrics publicly in this release.

