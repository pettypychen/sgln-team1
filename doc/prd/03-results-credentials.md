# PRD 03: Results and Credentials

Status: Draft for prototype implementation  
Parent: [Evaluation and Credentials Program](./00-evaluation-credentials-program.md)  
Depends on: [Submission and Evaluation Pipeline](./01-submission-evaluation-pipeline.md)

## Outcome

After a human finalizes an evaluation, the learner receives an outcome email and can open a private Credentials collection. Passing a case unlocks a professional collectible badge that the learner may share through a revocable public verification page and add to LinkedIn.

## Result release

No learner-visible result is final until human evaluation is complete.

Immediately after submission, show:

- Case title.
- Attempt number.
- Submission timestamp.
- Confirmation that the attempt is immutable.
- Current status: AI evaluation processing, awaiting human review, or finalized.
- Private result link stored in the browser.

Hide the provisional AI score while human review is pending.

## Outcome emails

Send one email after every human-finalized outcome.

### Pass

Include:

- Case title.
- Pass outcome and optional supplemental case label.
- Short evaluator summary.
- Private Credentials link.
- Newly earned badge preview.
- Clear action to view or share the credential.

### Remediation required

Include:

- Outcome.
- Short evaluator summary.
- Private link to criterion-level feedback.
- Action to start a fresh linked attempt.

Do not issue a badge.

### Not yet ready

Include:

- Outcome.
- Short evaluator summary.
- Private link to feedback.
- Recommended next step.

Do not issue a badge.

Do not place the full transcript, detailed evidence, email address, or sensitive scoring data in email.

## Private Credentials collection

Access uses the learner's unguessable private credential link.

The page shows:

- Earned badges.
- Locked badges for released cases.
- Finalized attempt history.
- Pass, Remediation required, or Not yet ready status.
- Evaluator feedback for the learner's own attempts.
- Retry actions where allowed.

The private link:

- Is long and random.
- Can be revoked and replaced.
- Must not expose its token in analytics or logs.
- Works across devices.
- Acts as a bearer credential, so anyone receiving a forwarded link may access the page.

Explain this prototype limitation to learners.

## Badge model

Issue one case-specific badge for Pass.

Badge metadata:

- Credential ID.
- Learner display name.
- Case title and category.
- Case and rubric versions.
- Attempt number.
- Award date.
- Issuer: SimWorks.
- Evaluation authority: Human verified with AI-assisted scoring.
- Supplemental outcome label, when applicable.
- Credential status: private, public, or revoked.

Remediation required and Not yet ready remain in private attempt history and never issue badges.

## Badge design direction

The collection should feel playful enough to collect and professional enough to place on LinkedIn.

Use:

- One original medallion or shield silhouette per case.
- Polished enamel-like colour.
- Subtle metallic edging and controlled depth.
- A simple case symbol.
- Desaturated silhouettes for locked badges.
- A restrained reveal animation when a badge is earned.
- A clean surrounding interface with generous spacing.

Do not copy Pokémon characters, gym badges, Apple award artwork, or another brand's protected visual assets.

Each case has one core badge. A higher case outcome such as Distinction uses a subtle accent, foil edge, or small premium marker rather than a separate badge.

Example: Kopi Run may use a deep-brown enamel kopi cup with a cream swirl inside a crimson-and-gold geometric medallion.

## Badge detail view

Selecting a badge opens:

- Large badge artwork.
- Credential name.
- Case description and skills demonstrated.
- Learner display name.
- Issue date.
- Issuer.
- Credential ID.
- Evaluation authority.
- Verification and revocation status.
- Share controls.

Do not show evaluator name, detailed scores, feedback, email, or transcript on a public view.

## Public sharing

Public sharing is opt-in.

The learner may:

- Create a public verification URL.
- Preview the public page.
- Copy the URL.
- Revoke the URL while retaining the private badge.
- Issue a replacement public URL after revocation.

The public page shows only:

- Badge artwork.
- Learner display name.
- Credential name.
- Case title and category.
- Issue date.
- Issuer: SimWorks.
- Credential ID.
- Valid or revoked status.
- Human verified with AI-assisted scoring.

Revoked credential URLs must clearly show that the public share link is no longer valid without exposing private credential data.

## LinkedIn readiness

Provide:

- An Add to LinkedIn action using LinkedIn's current static Add to Profile flow.
- One-click copy controls for credential name, issuer, issue date, credential ID, and credential URL.
- A short suggested description of the demonstrated skill.
- Open Graph and social-card metadata for a polished shared-link preview.

LinkedIn currently requires users to enter certification details themselves rather than allowing third-party credential fields to be prefilled. The UI must set that expectation instead of promising automatic population.

Reference: [LinkedIn Add to Profile FAQ](https://www.linkedin.com/help/linkedin/answer/a528030/linkedin-add-to-profile-feature-frequently-asked-questions)

## Notification and issuance integrity

Finalization must:

- Create at most one badge per passing attempt.
- Send at most one result email per finalized review version.
- Support safe retries after provider failure.
- Record email delivery attempts and badge issuance status.
- Never issue a badge before the human final decision commits.

If badge issuance or email delivery fails after finalization, the result remains final and an operator can retry the failed side effect.

## Accessibility and motion

- Badge artwork includes meaningful text alternatives.
- Locked and earned states do not depend on colour alone.
- Reveal motion respects reduced-motion preferences.
- Share and revoke actions are keyboard accessible.
- Revocation requires confirmation.
- Credential status is readable without the artwork.

## Out of scope

- Public aggregate pass rates.
- Public rankings.
- Downloadable PDF certificates.
- Wallet integrations.
- LinkedIn API posting or automatic credential-field population.
- Expiring badges.
- Multi-case or pathway credentials.

## Acceptance criteria

- A learner receives a receipt email after submission.
- No result email is sent before human finalization.
- Each final outcome sends the correct email.
- Only Pass issues a badge.
- The learner can open private results on another device through the emailed link.
- Locked badges reveal no other learner data.
- A passing learner can create and revoke a public verification URL.
- Public pages contain no scores, feedback, evaluator name, transcript, or email.
- LinkedIn controls provide every field needed for manual entry.
- Shared links render a professional social preview.
- Distinction changes only the badge accent, not the case badge identity.
- Retrying finalization cannot create duplicate emails or badges.

## Design validation

Before release, test the four badges together:

- They read as one collection.
- Each case remains distinguishable at small size.
- The collection feels playful without looking juvenile.
- Locked states invite completion without implying failure.
- Public cards remain legible in LinkedIn's link-preview crop.

