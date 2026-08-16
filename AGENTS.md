# AGENTS.md — SimWorks

Instructions for an autonomous coding agent working in this repo.

## What the app is

`/Users/mwagent-net/Documents/github/sgln-team1` — SimWorks is a simulation marketplace where learners work through realistic professional cases with an AI agent. The prototype covers learner workspaces, immutable submission, shared human evaluation (with AI as copilot), result delivery, and portable credentials. Evaluators review AI-scored submissions and may override scores with mandatory reasons. Credentials are delivered via private bearer-token links and publicly verifiable via `/verify/:publicToken`.

## Repo layout

- `app/frontend/` — All frontend code (the only directory to edit for UI work)
  - `src/pages/` — `MarketplacePage`, `ModuleWorkspacePage`, `EvaluatorQueuePage`, `EvaluatorReviewPage`, `CredentialsPage`, `LoginPage`, `IdeationJourneyPage`, `PrototypeCasePage`, `ReadyForEvaluationPage`, `PublicCredentialPage`
  - `src/content/simulations/` — Versioned case content and rubrics for `first-year-associate-ma-due-diligence`, `month-end-close-under-pressure`, `kopi-run`
  - `src/evaluation/` — Domain types, rubric definitions, evaluation session logic, Firestore repository, submission snapshot
  - `src/lib/` — Firebase client (`firebase.ts`), submission store (`submissionStore.ts`), AI agent client (`agentClient.ts`)
  - `src/participant/` and `src/data/` — Participant session, ideation journey data, module workspace
- `functions/` — Firebase Functions: `index.js` (entry), `evaluation.js`, `submission-evaluator.js`, `notifications.js`, `publicCredential.js`, `token.js`; generated case package at `functions/generated/cases.json`
- `doc/prd/` — PRDs for evaluation pipeline, evaluator console, credentials, and case packs
- `firebase.json`, `firestore.rules`, `firestore.indexes.json` — Firebase project config

## Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, React Router
- **Backend**: Firebase Functions (Node.js); Firestore as the shared persistence layer
- **Auth**: Lightweight prototype — learners use display name + email + browser-retained participant ID; evaluators use a server-validated shared access code
- **AI providers**: Configurable via `.env` keys (`VITE_ANTHROPIC_API_KEY`, `VITE_OPENAI_API_KEY`, etc.); falls back to a scripted demo agent if none are set
- **Local fallback**: Browser-local seeded repository when `VITE_EVALUATION_API_ENDPOINT` is not configured

## Run / verify

```bash
cd app/frontend
npm install
npm run dev         # Vite dev server (local fallback mode, no Firebase needed)
npm test            # verify local Firebase-free fallback
npm run build       # production build
```

For production with Firebase: set `VITE_EVALUATION_API_ENDPOINT` and `VITE_AGENT_ENDPOINT` in `app/frontend/.env`. Provider API keys (e.g. `VITE_ANTHROPIC_API_KEY`) are also set there; restart the dev server after editing `.env`.

## Constraints

- Do not `git add`/`commit`/`push`. Leave changes as working-tree edits for review.
- All frontend work happens in `app/frontend/` — `src/` at repo root is a placeholder (`.gitkeep` only).
- Rubrics and case content are versioned per case in `src/content/simulations/` — do not hardcode a universal scoring model; thresholds and competencies are case-specific.
- Evaluation authority is `human_final` for all prototype cases. Do not change authority levels without explicit instruction.
- Operational submissions must not be used to train or validate automated evaluation during the prototype — no pipelines to export submission data for model training.
- Private credential links are bearer tokens — do not log or expose them in error messages or analytics.
