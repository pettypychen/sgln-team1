# PRD 01: Submission and Evaluation Pipeline

Status: Draft for prototype implementation  
Parent: [Evaluation and Credentials Program](./00-evaluation-credentials-program.md)

## Outcome

A learner can explicitly submit an AI-assisted simulation from any device. SimWorks stores an immutable attempt, runs a case-specific AI evaluation, and places the attempt into a shared human-review queue without coupling the frontend to one database vendor.

## Users

- Learner completing a simulation.
- Human evaluator reviewing submitted attempts.
- Case author supplying case and rubric versions.
- Engineering operator diagnosing failed evaluation runs.

## User stories

- As a learner, I can submit only when I choose to do so.
- As a learner, I receive a durable receipt proving what and when I submitted.
- As an evaluator, I can trust that the transcript and rubric did not change after submission.
- As an evaluator, I receive an AI recommendation before I review the attempt.
- As a case author, I can change a future rubric version without changing past attempts.
- As an operator, I can retry a failed AI evaluation without overwriting its failed run.

## Functional requirements

### Learner identity

Before submission, collect:

- `displayName`, required.
- `email`, required.
- `participantId`, generated and retained in the browser.

Create an unguessable private access token for the learner's results and credentials. Store only a secure representation of the token server-side. Email the learner an immediate receipt so an incorrectly entered address is discovered before evaluation completes.

This is a prototype capability-link model, not full authentication.

### Explicit submission

The learner must select Submit for evaluation and confirm that:

- Their conversation becomes immutable.
- The case will be scored using the displayed case and rubric versions.
- Human review is required before any outcome is released.

The submit operation must be idempotent. Repeated clicks or network retries must return the same attempt rather than create duplicates.

### Immutable attempt snapshot

The attempt stores:

- Attempt ID and attempt number.
- Participant ID and learner display name.
- Case ID, case version, rubric version, and evaluation mode.
- Full ordered transcript, including learner and agent roles, status, and timestamps.
- Source-artifact identifiers and versions.
- Coverage and interaction metadata available at submission.
- Submission timestamp.
- Link to a predecessor attempt when created through remediation.

Email addresses belong in protected participant contact data, not in the transcript or evaluation payload.

### Rubric contract

Every released case supplies:

- `evaluation.md` for human-readable evaluator guidance.
- A machine-readable rubric with stable criterion IDs.
- Separate case-outcome and AI-interaction threshold definitions.
- Criterion weights or maximum points.
- Optional critical-failure rules.
- A rubric version matching the human-readable document.

The pipeline must reject or quarantine a case whose rubric files disagree on version or whose structured rubric fails validation.

### Automatic AI evaluation

Submitting an attempt automatically creates an evaluation run.

The evaluation service receives:

- Immutable attempt snapshot.
- Immutable source artifacts.
- Human-readable evaluation guidance.
- Machine-readable rubric.
- A versioned evaluation prompt.

The evaluation service returns:

- Score for every rubric criterion.
- Separate case-outcome and AI-interaction totals.
- Threshold outcome for each dimension.
- Recommended shared outcome.
- Explanation for every criterion.
- Evidence references for every awarded point.
- Critical-failure findings.
- Machine-readable validation status.

The AI score is a visible copilot recommendation. It is not a final learner result while the case is in `human_final` mode.

### Mandatory evidence

Every criterion with awarded points must cite:

- One or more transcript message IDs and short excerpts.
- Relevant source-document page, CSV row, cell, or source item when applicable.
- A short connection between evidence and the rubric rule.

Evidence references must resolve against the immutable snapshot. Unsupported awarded points are flagged and excluded from the recommendation until corrected or accepted by a human with a reason.

### Evaluation-run lineage

Store for every run:

- Run ID and attempt ID.
- Provider and model identifier.
- Prompt version.
- Case and rubric versions.
- Material runtime settings.
- Start and completion timestamps.
- Status.
- Raw structured result.
- Validation errors.
- Parent run ID when retried.

A retry creates a new run. It never replaces the failed or completed run.

### Human final authority

All four prototype cases use `human_final`.

The pipeline supports these future case modes:

| Mode | Final authority |
| --- | --- |
| `human_final` | Human finalizes every attempt |
| `human_confirmation` | Human confirms or changes the AI recommendation |
| `ai_final_audited` | AI finalizes; selected attempts enter human audit |

Changing a case's mode affects only submissions created after the effective change unless an explicit migration is approved.

### Remediation and retry

Remediation creates a fresh attempt:

- Prior attempt remains immutable.
- Learner sees finalized feedback.
- New transcript starts fresh.
- New attempt links to its predecessor.
- Every attempt receives an independent AI evaluation and human review.
- The prototype imposes no retry limit.

## State model

```text
Draft
  -> Submitted
  -> Pending AI processing
  -> AI evaluation processing
      -> Ready for human review
      -> AI evaluation failed
  -> In human review
      -> Review draft saved
      -> Pass
      -> Remediation required
      -> Not yet ready
```

`AI evaluation failed` remains eligible for manual review. Retrying AI evaluation adds a new run and may move the attempt to Ready for human review.

## Logical data contract

These are product entities, not a prescribed database schema.

| Entity | Required purpose |
| --- | --- |
| Participant | Stable learner identity and protected contact details |
| PrivateAccessGrant | Revocable learner capability link |
| CaseDefinition | Stable case identity, version, artifacts, and evaluation mode |
| RubricDefinition | Versioned case-specific scoring contract |
| Attempt | Immutable submitted transcript and metadata |
| EvaluationRun | Versioned AI score, evidence, status, and lineage |
| ReviewClaim | Time-bounded evaluator edit claim |
| HumanReview | Draft and finalized human assessment |
| Credential | Badge issuance and public-verification state |
| Notification | Idempotent delivery record for receipt and result email |

## Service capabilities

The selected backend must support:

- Shared writes and reads across devices.
- Atomic attempt creation and idempotency.
- Immutable or append-only protection for submitted content.
- Atomic review claims and claim expiry.
- Privileged evaluator actions.
- Background or asynchronous AI evaluation.
- Secure secret storage.
- Transactional or idempotent finalization, email, and badge issuance.
- Querying attempts by case, status, recommendation, and submission date.
- Revocable, unguessable private and public access tokens.

The PRD does not select Firebase, Firestore, SQL, or another technology.

## API behavior requirements

The implementation may use HTTP, RPC, or SDK calls, but it must provide equivalent operations:

- Create or recover learner identity.
- Submit an attempt idempotently.
- Fetch learner-owned attempts through a private access grant.
- Fetch evaluator queue summaries and attempt details.
- Retry a failed evaluation run.
- Claim, renew, release, and take over a review.
- Save a human-review draft.
- Finalize a human review.
- Create, revoke, and resolve a public credential link.

## Security and privacy requirements

- Validate the evaluator access code server-side.
- Never ship evaluator codes, email-service secrets, or AI keys to the browser.
- Do not expose contact data in public credential responses.
- Do not expose one learner's private results through another learner's token.
- Rate-limit submission, evaluator-code checks, and token resolution.
- Treat transcripts as potentially sensitive operational data.
- Warn learners not to enter confidential, client, or sensitive personal information.

Operational data must not be reused to train or validate automated evaluation during the prototype. Consent, de-identification, retention, and deletion controls belong on the roadmap before such reuse.

## Failure handling

| Failure | Required behavior |
| --- | --- |
| Submit request times out | Retry returns the same attempt |
| AI provider fails | Attempt remains manually reviewable |
| AI output is malformed | Mark run invalid; allow retry or manual review |
| Evidence reference does not resolve | Flag unsupported score |
| Email receipt fails | Keep attempt; expose operator retry |
| Finalization partially fails | Idempotent retry must not issue duplicate email or badge |
| Private token is revoked | Deny access and support issuing a replacement |

## Acceptance criteria

- Two separate browsers can submit and retrieve distinct attempts.
- Double-clicking Submit creates one attempt.
- Editing browser-local progress after submission does not change the attempt.
- Past attempts retain their original case and rubric versions.
- AI evaluation begins without evaluator action.
- Every awarded AI point has resolvable evidence or is flagged unsupported.
- A failed run can be retried without deleting the original run.
- Manual human review works when every AI run has failed.
- Remediation creates a linked new attempt with a fresh transcript.
- Finalization retries do not duplicate notifications or credentials.

## Instrumentation

Track:

- Submission success and idempotent-retry rate.
- AI evaluation completion, failure, validation-error, and retry rates.
- Time from submission to AI-ready.
- Time from AI-ready to human finalization.
- Human override frequency by case and criterion.
- Pass, remediation, and not-yet-ready counts inside evaluator-only reporting.

