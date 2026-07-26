# Evaluation and Credentials PRD Implementation Status

Updated: 2026-07-26

This file records implementation evidence for PRDs 00–04. It distinguishes
repository-complete work from deployment validation that requires configured
external services or colleague-owned content.

`.github/workflows/prd-verification.yml` reproduces the complete local gate on
pull requests and `main`: Node 22 frontend tests/build, Functions case sync and
18 backend tests, Java 21 Firebase security rules, and the full emulator
integration suite. The emulator launcher discovers its runtime paths instead
of relying on one developer workstation.

## Implemented and locally verified

| PRD | Delivered capability | Verification |
| --- | --- | --- |
| 00 | Attempt-centric learner, evaluator, result, and credential flow with human-final authority and dual thresholds | Frontend domain tests, backend tests, production build, and browser walkthrough |
| 01 | Immutable idempotent submissions, coverage/interaction metadata, versioned case/rubric snapshots, durable background evaluation jobs, bounded provider calls, exact transcript/source evidence validation, server-side queue queries, fail-closed client rules, run lineage, recoverable AI failure, linked remediation attempts, and idempotent finalization | `npm test` in `app/frontend`; 18 backend tests via `npm run predeploy`; expanded `npm run test:emulator` suite |
| 02 | Shared queue, summary, persistent filters, stable review URLs, next-oldest routing, dynamic rubrics, source-artifact navigation, required override reasons, transactional claims/takeover/drafts, manual failure review, finalization, and evaluator-only reporting | Desktop and 375px browser walkthrough plus evaluation-domain tests |
| 03 | Receipt/result notification records, provider-neutral text/HTML email delivery, leased scheduled retries and operator requeue, fragment-delivered private bearer collection, four distinct earned/locked badge shapes, attempt history, private-link rotation, transactional idempotent public create/revoke/resolve, strict public privacy allowlist, PNG social metadata, and LinkedIn manual-entry fields | Backend privacy/idempotency tests, emulator failure/retry and concurrency assertions, and browser walkthrough through issuance, sharing, and revocation |
| 04 | Versioned Legal, Accounting, and Kopi Run packages; deterministic Accounting exceptions; playable Accounting and Kopi flows; dynamic case-specific rubrics; Business Analyst release block | Case-package tests and browser walkthrough |

## Acceptance-criterion evidence

### PRD 01: Submission and Evaluation Pipeline

| Criterion | Current evidence |
| --- | --- |
| Separate browsers create distinct shared attempts | Firestore emulator test submits concurrent independent learners and verifies distinct shared attempts and counters; physical-device check remains a release gate |
| Learner and evaluator operational data is server-only | Emulator REST checks prove released simulation reads are allowed while unreleased simulations, direct operational reads, operational writes, and simulation writes are denied |
| Double-submit creates one attempt | Local idempotency test plus Firestore idempotency-key transaction |
| Later local edits cannot mutate a submitted attempt | Immutable snapshot test |
| Attempts retain case and rubric versions | Snapshot assertions and case-package version tests |
| AI evaluation starts without evaluator action | Attempt transaction creates a durable `evaluationJobs` record; export test plus live Firestore/Functions trigger test |
| Awarded AI points have resolvable evidence or become unsupported | Exact transcript-excerpt and source-locator validation plus strong/borderline/weak outputs for every released case and every artifact type |
| Retry preserves the failed run | Local lineage test and emulator-verified initial failure followed by successful retry with `parentRunId` |
| Manual review works when all AI runs failed | Frontend and backend review-validation tests |
| Remediation creates a fresh linked attempt | Fresh transcript, attempt number, and predecessor assertions |
| Finalization retry does not duplicate notification or credential | Unit and emulator idempotency tests plus fixed Firestore document IDs |

### PRD 02: Evaluator Console

| Criterion | Current evidence |
| --- | --- |
| One row per attempt, including retries | Browser queue walkthrough |
| Queue summary and filters use the shared repository | Backend case/status/recommendation/date query assertions plus browser verification that case/status filters survive review navigation |
| Stable attempt detail URLs | Route and browser navigation checks |
| Rubrics render without case-specific criterion UI | Case-package schema comparison and generic criterion loop |
| Evidence jumps to a source or displays an error | Browser verification opens and focuses the actual source packet at its locator; unresolved-evidence and historical-ID compatibility tests |
| AI-score and outcome overrides require separate reasons | Frontend and backend validation tests |
| Draft save has no release side effect | Browser draft-save check and separate finalization code path |
| Finalize sends one result notification and only Pass issues a badge | Pass and both non-pass finalization tests |
| Claims prevent concurrent editing and record takeover | Firestore transactions plus two-session emulator conflict, takeover, and stale-draft rejection tests |
| AI failure allows manual finalization | Frontend and backend failure-path tests |
| Unsaved edits warn before leaving | `beforeunload` handler, guarded evaluator links, and browser confirmation for both cancel and confirmed discard |
| Evaluator-only reporting is displayed | Queue browser walkthrough; median and failure-rate logic tests |

### PRD 03: Results and Credentials

| Criterion | Current evidence |
| --- | --- |
| Submission receipt and all three result emails | Privacy-safe text/HTML template tests; real inbox delivery remains a deployment gate |
| No provisional result email | Notification worker final-review guard |
| Only Pass issues a badge | Pass, Remediation, and Not Yet Ready finalization tests |
| Private results work from the bearer URL | Browser verifies the URL fragment is consumed and removed before collection display; shared Firestore emulator verifies resolution and rotation; physical-device check remains a release gate |
| Locked badges reveal no other learner data | Browser collection walkthrough |
| Public URL create, idempotent create, revoke, and replacement | Repository tests plus concurrent Firestore transaction assertion in the emulator |
| Public response excludes scores, feedback, evaluator, transcript, email, participant ID, and attempt ID | API allowlist and server-rendered HTML tests |
| LinkedIn manual-entry fields and suggested description | Credential-detail browser walkthrough and explicit copy fields |
| Professional social preview | 1200×630 PNG verification and Open Graph tests |
| Supplemental label changes only the premium accent | Four stable case-specific silhouettes and symbols with an optional premium marker; computed browser styles verified |
| Finalization and email retries remain idempotent | Fixed IDs, leases, provider idempotency key, backoff scheduler, operator requeue endpoint, and emulator-verified first-delivery failure followed by scheduled retry |

### PRD 04: Prototype Case Pack

| Criterion | Current evidence |
| --- | --- |
| Legal content retained with structured rubric | Versioned content and JSON-to-runtime schema test |
| Accounting uses all three artifacts and fixed exception set | Artifact, row-count, planted-reference, and answer-key tests |
| Business Analyst remains blocked | `released: false`, preview-only marketplace state, and regression assertion |
| Kopi Run requires clarification, substitution, verification, and correction | Source-content and readiness-gate tests plus browser walkthrough |
| Every case uses case-specific dual thresholds | Rubric schema tests |
| Evaluator renders all four rubrics generically | Seeded four-case queue and generic rubric component |
| Evidence uses each case's artifact IDs | Every released artifact type is validator-tested; browser citation navigation resolves current filenames and immutable historical packet IDs |
| Five-minute completion and human differentiation quality | Requires timed first-user and reviewer validation before release |

## Deployment validation gates

These are not hardcoded or falsely simulated in production. They require
deployment configuration before release sign-off:

1. Configure Firebase secrets and deploy Firestore, Functions, Hosting, rules,
   and indexes.
2. Configure a structured `EVALUATION_ENDPOINT`, then validate strong,
   borderline, and weak transcripts for every released case with the selected
   provider/model.
3. Configure `EMAIL_DELIVERY_ENDPOINT`, then verify receipt and all three
   finalized-outcome emails on real inboxes, including retry receipts from the
   provider.
4. Run the shared-persistence acceptance test from two physical devices.
5. Complete human content review and small-size/social-crop design review for
   the four-badge collection.
6. Keep Requirements Gathering Workshop unreleased until the colleague-owned
   case and rubric are supplied and approved.

The browser-local repository is intentionally a demo fallback. It marks new
automatic evaluations as failed and manually reviewable when no production
evaluation provider is configured; it does not claim provider success.

## Dependency audit note

`npm audit --omit=dev` reports nine moderate advisories for `uuid@9.0.1`
through the current Firebase Admin 13.10.0 Google Cloud dependency chain. The
reported automated fix is a breaking downgrade to Firebase Admin 10.3.0, so it
was not forced. The affected `uuid` buffer-writing APIs are not called by this
application. Recheck the advisory after Firebase publishes a compatible
dependency update. Development-only Firebase CLI advisories do not ship with
the Functions production install.
