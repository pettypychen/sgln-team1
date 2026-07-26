# SimWorks Evaluation and Credentials Program

Status: Draft for prototype implementation  
Owner: SimWorks product team  
Last updated: 2026-07-26

## Purpose

SimWorks needs an end-to-end path from a learner's AI-assisted simulation to a defensible human decision and a portable credential. The prototype must let multiple learners submit from different devices, let evaluators review every attempt with an AI copilot, and award a professional collectible badge only after a human finalizes a Pass.

This brief coordinates four implementation PRDs:

1. [Submission and Evaluation Pipeline](./01-submission-evaluation-pipeline.md)
2. [Evaluator Console](./02-evaluator-console.md)
3. [Results and Credentials](./03-results-credentials.md)
4. [Prototype Case Pack](./04-prototype-case-pack.md)

## Current product baseline

The repository already contains:

- A marketplace and learner workspace.
- One fully authored case, First-Year Associate: M&A Due Diligence.
- A human-readable `evaluation.md` for that case.
- Browser-local simulation progress and transcripts.
- A client-side heuristic grader that is explicitly directional, not authoritative.
- A provider-agnostic serverless proxy for learner conversations.
- A placeholder Ready for Evaluation route.

The repository does not yet contain:

- Immutable shared submissions.
- A multi-user evaluator queue.
- Production AI-evaluation runs against versioned rubrics.
- Human review records, review claims, or final decisions.
- Result email delivery.
- A Credentials page, badge issuance, or public verification.

## Product principles

### Human authority first

Every prototype case begins in `human_final` mode. AI evaluates first and acts as a visible copilot, but a human owns the final outcome.

Authority changes per case, not globally:

1. `human_final`: every attempt requires a human final decision.
2. `human_confirmation`: AI recommends and a human confirms or changes it.
3. `ai_final_audited`: AI decides, with selected attempts sent to human audit.

A case may move toward AI authority only after meeting a documented evidence gate. The initial working gate is:

- At least 200 independently reviewed attempts for that case.
- At least 95% agreement on Pass versus Not Pass.
- False-pass rate below 2%.
- Competency scores within an agreed tolerance.
- No material disparity across monitored learner groups.
- Formal approval by a named owner.
- Periodic revalidation and automatic reversion if quality drops.

These numbers are planning defaults, not launch acceptance criteria. They must be reviewed before any case changes authority.

### Dual-threshold proficiency

Every case measures two distinct outcomes:

- Case outcome proficiency.
- AI-interaction proficiency.

A learner passes only if both case-defined thresholds are met. Competencies, weights, thresholds, and critical-failure rules remain case-specific. The cross-case AI-evaluation rubric is being developed separately and must not be hardcoded into the evaluator UI.

### Rubric-driven interfaces

Every case must have:

- A human-readable `evaluation.md`.
- A version-matched machine-readable rubric definition.

The UI renders criteria, weights, thresholds, and failure rules from case data. This keeps the product flexible while the rubric work evolves.

### Immutable attempts

An explicit learner submission creates an immutable snapshot. Remediation creates a fresh attempt linked to the prior attempt. Submitted transcripts, case versions, rubric versions, and source artifacts never change in place.

### Evidence before explanation

Every AI-awarded score must cite specific transcript messages and relevant source material. Unsupported points are flagged and cannot silently count toward the recommendation.

## Prototype release scope

The release includes:

- Four cases described in the [Prototype Case Pack](./04-prototype-case-pack.md).
- Explicit, immutable learner submission.
- Shared persistence across devices.
- Automatic AI evaluation at submission time.
- Human evaluator queue at `/eval/all-cases`.
- Criterion-level AI review, human editing, and reasoned overrides.
- Explicit Save draft and Finalize evaluation actions.
- Outcome emails for Pass, Remediation required, and Not yet ready.
- A private Credentials collection reached through an unguessable personal link.
- A unique collectible badge for each passed case.
- Optional public, revocable badge verification and LinkedIn-ready sharing.

## Out of scope

- A public Live Results section or public pass-rate dashboard.
- Public learner rankings or transcripts.
- Full evaluator role-based accounts.
- Full learner accounts and passwords.
- Selecting the database, hosting, email, queue, or AI provider.
- Defining the Business Analyst case or its rubric.
- Reusing operational submissions to train or validate automated evaluation.
- Moving any case to `human_confirmation` or `ai_final_audited`.

## Prototype access model

### Learners

Learners provide:

- Display name.
- Email address.
- Browser-retained participant ID.

They receive a long, random, revocable private credential link. The link is the prototype access mechanism for results, attempt history, and badges. It is not a full account. Anyone who receives a forwarded link could access the private view, so the product must explain this limitation.

### Evaluators

Evaluators use:

- One environment-configured access code validated by the server.
- A self-entered evaluator display name.

Every draft, claim, override, and final decision records the entered name. This is prototype attribution, not verified identity. Proper evaluator accounts, roles, and immutable identity are post-prototype requirements.

## Release dependencies

| Dependency | Owner | Release condition |
| --- | --- | --- |
| Cross-case AI-evaluation rubric | User's colleague | Case-specific rubric data is available for released cases |
| Business Analyst case | User's colleague | Case is supplied and integrated without inventing missing content |
| Shared persistence architecture | Engineering owner | Technology selected and capabilities in PRD 01 satisfied |
| AI evaluation service | Engineering owner | Structured, evidence-linked evaluation runs reliably |
| Email delivery | Engineering owner | All finalized outcomes trigger the correct email |
| Badge artwork | Design owner | Four original case badges pass professional-quality review |

## Delivery sequence

1. Define shared types and a repository interface.
2. Build the attempt-centric evaluator UI against seeded data for the three professional cases.
3. Add Kopi Run and its evaluator fixtures.
4. Implement shared persistence and immutable submission.
5. Implement automatic AI evaluation and evidence citations.
6. Add human review, locks, draft save, and finalization.
7. Add result emails, private credential links, badges, and verification.
8. Run end-to-end multi-device acceptance testing.

## Release success criteria

The prototype is ready when:

- Two learners on separate devices can submit attempts that appear in one evaluator queue.
- A submitted attempt remains unchanged after submission.
- AI evaluation completes or fails into a recoverable manual-review state.
- An evaluator can claim, save, finalize, and release a claimed attempt.
- Criterion overrides require reasons and preserve the original AI assessment.
- Finalizing each outcome sends exactly one appropriate email.
- Pass issues exactly one case badge and no other outcome issues one.
- A learner can open their private Credentials collection from email.
- A learner can opt into a public, revocable credential URL suitable for LinkedIn.
- No public route exposes another learner's transcript, scores, email, or feedback.

## Open implementation decisions

The PRDs deliberately leave these decisions to engineering:

- Persistence technology and schema implementation.
- API style and job-processing mechanism.
- Email provider.
- AI provider and model.
- Machine-readable rubric serialization, with `rubric.json` as the simplest default.
- Token hashing, rotation, and revocation design.
- Exact review-claim timeout, with 15 minutes as the product default.

