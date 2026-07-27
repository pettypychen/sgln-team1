# PRD 04: Prototype Case Pack

Status: Draft for prototype implementation  
Parent: [Evaluation and Credentials Program](./00-evaluation-credentials-program.md)

## Outcome

The prototype launches with four cases that make the evaluator workflow credible across professional domains while giving first-time testers a short, Singapore-specific onboarding experience.

## Shared case requirements

Every released case must provide:

- Stable slug and case version.
- Case instructions.
- Versioned source artifacts.
- Human-readable `evaluation.md`.
- Version-matched machine-readable rubric.
- Separate case-outcome and AI-interaction thresholds.
- Case-specific competencies, weights, and critical-failure rules.
- AI coaching prompt.
- AI evaluation prompt or prompt inputs.
- Badge theme.

The learner must pass both case-defined dimensions. There is no universal rubric or fixed cross-case 70-point threshold in this PRD.

## Case 1: First-Year Associate: M&A Due Diligence

Category: Legal  
Status: Existing case and `evaluation.md` are implemented  
Slug: `first-year-associate-ma-due-diligence`

### Prototype work

- Preserve the current case and deterministic human-readable evaluation.
- Add a version-matched machine-readable rubric with stable criterion IDs.
- Convert learner submission from browser-local progress to an immutable shared attempt.
- Run production AI evaluation against the complete transcript and source packet.
- Add evidence references to transcript messages and packet pages.
- Confirm case-outcome and AI-interaction thresholds with the rubric owner.
- Create a unique legal-case badge.

The current client-side keyword grader remains a learner-facing directional aid until replaced. It is not the official evaluation.

## Case 2: Month-End Close Under Pressure

Category: Accounting  
Audience: Early-career accounting associate  
Status: New case to author with online research

### Learning objective

The learner uses AI to review a small period-end dataset, identify exceptions, verify calculations, prioritize close blockers, and write a concise finance-manager update.

The case must remain distinct from the marketplace's separate Reconciling a Messy Ledger case. It tests close readiness and adjusting-entry judgment, not a full bank reconciliation.

### Source artifacts

#### `general-ledger.csv`

Approximately 30 journal lines with:

- Journal ID.
- Posting date.
- Account code and name.
- Description.
- Debit.
- Credit.
- Posting status.
- Vendor or counterparty.
- Source reference.

Plant a controlled set of exceptions, such as:

- Duplicate expense or invoice.
- Posting outside the target period.
- Unposted or incomplete journal.
- Missing accrual supported by manager notes.
- Unusual entry requiring investigation.
- Entry whose debit and credit treatment needs verification.

The final planted set must be deterministic and documented in the rubric.

#### `close-checklist.csv`

Include:

- Task.
- Owner.
- Due date.
- Completion status.
- Dependency.
- Evidence reference.

#### `manager-notes.md`

Include concise clues about:

- Services received but not yet invoiced.
- Late invoices.
- Expected adjustments.
- Known open tasks.
- Manager deadline and reporting expectation.

### Learner task

The learner must use AI to:

1. Inspect the supplied artifacts.
2. Identify the deterministic exceptions.
3. Verify totals and challenge incorrect AI calculations.
4. Propose corrections or investigations without claiming to post entries.
5. Prioritize blockers to month-end close.
6. Produce a short close-readiness summary.

### Research basis

Official close guidance describes verifying posted journals, entering period-end adjustments, reviewing ledger reports, reconciling subledgers, and controlling the posting period:

- [Microsoft Dynamics 365: Close the general ledger at period end](https://learn.microsoft.com/en-us/dynamics365/finance/general-ledger/close-general-ledger-at-period-end)
- [Microsoft Business Central: Overview of tasks to close accounting periods](https://learn.microsoft.com/en-us/dynamics365/business-central/year-how-complete-period-end-processes)

The authored case should use fictional company data and must not require Singapore tax expertise.

## Case 3: Requirements Gathering Workshop

Category: Business Analyst  
Status: External release dependency  
Owner: User's colleague

The colleague owns the use case, artifacts, and evaluation rubric. This PRD does not invent placeholder content or scoring. Integrate the supplied case through the same versioned case and rubric contracts used by the other cases.

The evaluator frontend may use seeded fixture data during early UI development. Release scoring must use the colleague-approved case package.

## Case 4: Kopi Run

Category: Onboarding  
Audience: Any prototype tester  
Target duration: Five minutes  
Status: New case to author

### Learning objective

Teach the SimWorks interaction loop without testing prior professional knowledge. The learner translates three colleagues' preferences into valid kopi orders, asks the AI to check one source-grounded match, verifies the total, and submits a clear final order.

The simulation's supplied glossary is the source of truth. Learners do not need prior kopi terminology.

### Source artifacts

#### `kopi-menu.csv`

Include:

- Item code.
- Drink name.
- Base drink.
- Milk modifier.
- Sugar modifier.
- Temperature or ice modifier.
- Availability.
- Price in SGD.

Use a fictional stall and prices.

#### `colleague-orders.csv`

Include three colleagues with:

- Display name.
- Plain-language preference.
- Dietary or ingredient constraint where relevant.
- Budget note where relevant.

#### `kopi-glossary.md`

Define every term and modifier used by the case. The evaluator must score against this glossary, not external assumptions.

### Learner task

The learner must:

1. Match each colleague to a menu item using the supplied glossary.
2. Ask the AI to check at least one match against a supplied source.
3. Verify every item price and the total.
4. Submit a final table with colleague, item code, translated order, price, and total.

### Badge direction

Use an original enamel-style kopi cup medallion. A deep-brown cup, cream swirl, and restrained crimson-and-gold geometry can make it recognizably Singaporean while remaining professional.

## Mock-data plan

### First frontend milestone

Seed evaluator attempts across the three professional cases:

- Legal.
- Accounting.
- Business Analyst.

Fixtures must cover:

- Awaiting review.
- In review.
- AI evaluation failed.
- Pass recommendation.
- Remediation recommendation.
- Not-yet-ready recommendation.
- A linked retry.
- A criterion override with evidence.

### Prototype release

Add Kopi Run fixtures and real submissions. The release queue then supports all four cases.

## Content validation

Before a case is released:

- Case and rubric versions match.
- Structured rubric passes schema validation.
- Every criterion has stable IDs.
- Every expected issue or calculation has a deterministic answer key.
- Every source citation can resolve to a page, row, cell, or item.
- AI coaching does not reveal the full answer.
- AI evaluation returns valid structured output on representative strong, borderline, and weak transcripts.
- Human reviewers agree that the case can distinguish both domain and AI-interaction proficiency.
- Badge artwork is original and legible at collection size.

## Acceptance criteria

- The Legal case keeps its current source content and gains a structured rubric.
- The Accounting case uses all three agreed artifacts.
- The Accounting answer key contains a fixed, testable exception set.
- The Business Analyst case remains blocked until colleague-approved content arrives.
- Kopi Run can be completed by a first-time tester in about five minutes.
- Kopi Run requires clarification, substitution, verification, and correction.
- Every case uses case-specific dual thresholds.
- Evaluator screens render all four rubrics without case-specific UI code.
- Every case can generate evidence citations into its own artifact types.

## Deferred work

- Additional professional cases from the marketplace catalogue.
- A universal AI-interaction rubric.
- Multi-case credentials or learning pathways.
- Localized case variants.
- Reusing submissions for model development.
