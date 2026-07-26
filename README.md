# SimWorks

SimWorks is a simulation marketplace where learners work through realistic professional cases with an AI agent. The prototype includes learner workspaces, immutable submission, shared human evaluation, result delivery, and portable credentials.

## Current state

- Frontend: React, TypeScript, Vite, and Tailwind CSS in `app/frontend`.
- Learner routes: `/simulations/first-year-associate-ma-due-diligence`, `/simulations/month-end-close-under-pressure`, and `/simulations/kopi-run`.
- Evaluator routes: `/eval/all-cases` and `/eval/all-cases/:attemptId`.
- Private credential route: `/credentials#privateToken` (the fragment keeps
  the bearer token out of server request logs).
- Public verification route: `/verify/:publicToken`.
- Versioned case content and rubrics: `app/frontend/src/content/simulations`.
- AI proxy, evaluation API, notification worker, and public credential renderer: `functions`.
- Browser-local seeded repository for local demos; Firestore-backed shared repository when `VITE_EVALUATION_API_ENDPOINT` is configured.

The shared implementation uses Firebase Functions and Firestore behind a provider-neutral frontend repository. Evaluation and email providers remain configurable endpoints rather than being coupled to a vendor.

## Evaluation and credential PRDs

Start with the [Evaluation and Credentials Program](./doc/prd/00-evaluation-credentials-program.md).

| Document | Scope |
| --- | --- |
| [Submission and Evaluation Pipeline](./doc/prd/01-submission-evaluation-pipeline.md) | Identity, immutable attempts, shared persistence capabilities, AI evaluation, and audit lineage |
| [Evaluator Console](./doc/prd/02-evaluator-console.md) | `/eval/all-cases`, attempt review, evidence, overrides, locks, save, and finalization |
| [Results and Credentials](./doc/prd/03-results-credentials.md) | Outcome email, private credentials, collectible badges, verification, and LinkedIn sharing |
| [Prototype Case Pack](./doc/prd/04-prototype-case-pack.md) | Legal, Accounting, Business Analyst, and Kopi Run release cases |

## Evaluation architecture decisions

### Human authority is a temporary, evidence-gated phase

All prototype cases begin with human final authority and visible AI-assisted scoring. Evaluation authority is configured per case and may later progress from `human_final` to `human_confirmation` and then `ai_final_audited`.

The transition cannot be based only on submission volume. Each case needs an evidence gate covering agreement, false-pass rate, score tolerance, group disparities, named approval, and ongoing revalidation. The umbrella PRD records the initial planning thresholds.

### Every case uses dual thresholds

A learner must demonstrate:

- Proficiency in the case outcome.
- Proficiency in working with AI.

Both dimensions must pass. Competencies, weights, thresholds, and critical failures are case-specific. The cross-case rubric is still being developed, so the product must not hardcode one universal scoring model.

### Rubrics stay flexible by design

Each case needs:

- A human-readable `evaluation.md`.
- A version-matched machine-readable rubric.

The evaluator interface renders criteria and thresholds from case data. This is intentional. It lets case authors refine the evaluation model without redesigning `/eval/all-cases`.

### Human review uses AI as a copilot

Evaluators see the AI score, explanation, and cited evidence before making their decision. They may edit criterion scores and override the recommended outcome, but every difference requires a reason. SimWorks preserves both the original AI assessment and the finalized human assessment.

### Prototype identity is intentionally lightweight

Learners use a display name, email, browser-retained participant ID, and an unguessable private credential link. Evaluators use a server-validated shared access code plus a self-entered display name.

These are prototype compromises. Private links are bearer credentials, and evaluator names are not verified identities. Full learner authentication, evaluator accounts, role-based access, and immutable identity belong after the prototype.

## Roadmap safeguards

Operational submissions must not be reused to train or validate automated evaluation during the prototype.

Before that use begins, SimWorks needs:

- Clear learner disclosure and explicit consent.
- De-identification that separates contact data from evaluation data.
- Retention and deletion rules.
- A way to withdraw future model-development use without invalidating an issued credential.
- Bias and disparity monitoring.
- Governance for moving a case toward AI final authority.

These safeguards are roadmap requirements, not part of the current prototype implementation.

## Prototype case plan

1. First-Year Associate: M&A Due Diligence, existing Legal case.
2. Month-End Close Under Pressure, new early-career Accounting case using ledger and checklist CSV files.
3. Requirements Gathering Workshop, Business Analyst case owned by a project colleague.
4. Kopi Run, a five-minute Singapore-specific onboarding case.

The first evaluator UI milestone uses seeded attempts for the three professional cases. Kopi Run joins before prototype release.

## Local frontend

```bash
cd app/frontend
npm install
npm run dev
```

Build and verify the local Firebase-free fallback:

```bash
npm test
npm run build
```

If no live agent endpoint is configured, the learner workspace uses its scripted demo agent.

## AI model selector

The chat panel shows a dropdown of AI providers. A provider appears only when its key is configured.

| Provider | Localhost key | Production secret |
| --- | --- | --- |
| Anthropic Claude | `VITE_ANTHROPIC_API_KEY` | `ANTHROPIC_API_KEY` |
| OpenAI | `VITE_OPENAI_API_KEY` | `OPENAI_API_KEY` |
| Google Gemini | `VITE_GOOGLE_API_KEY` | `GEMINI_API_KEY` |
| Z.ai | `VITE_ZAI_API_KEY` | `ZAI_API_KEY` |
| Alibaba Qwen | `VITE_ALIBABA_API_KEY` | `ALIBABA_API_KEY` |
| DeepSeek | `VITE_DEEPSEEK_API_KEY` | `DEEPSEEK_API_KEY` |

**Localhost** — set keys in `app/frontend/.env` (gitignored). Only Anthropic Claude is implemented for direct local calls; selecting another model shows "AI model not implemented yet." until its call path is added.

**Production** — API keys are stored as Firebase secrets (see [functions/README.md](./functions/README.md)). `VITE_AGENT_ENDPOINT=/api/agent` is injected at build time by the GitHub Actions workflow, routing all model calls through the Function proxy. All configured providers become available.

If no keys are set, the dropdown shows "No AI model configured" and the workspace uses the built-in scripted agent.
