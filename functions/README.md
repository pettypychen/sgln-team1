# Case-agent proxy

Serverless proxy (Firebase Functions, 2nd gen) that dispatches a conversation
turn from the case workspace to **Anthropic**, **OpenAI**, or **Gemini**. It
exists so the LLM API keys stay server-side — the frontend is a static site and
must never ship a key to the browser.

## Contract

`POST /api/agent` (Hosting rewrite → `agentChat` function)

```jsonc
// request
{
  "provider": "anthropic",            // "anthropic" | "openai" | "gemini"
  "system": "…system prompt…",
  "messages": [{ "role": "user", "content": "…" }]
}
// response
{ "content": "…assistant reply…" }
```

## Local development

The simplest way to test locally is the **direct key** approach — no emulator needed:

```bash
# In app/frontend/.env (gitignored — never committed):
VITE_ANTHROPIC_API_KEY=sk-ant-your-key-here
```

Then run `npm run dev` as normal. The frontend calls Anthropic directly from
the browser using your local key. Priority order in the client:

1. `VITE_AGENT_ENDPOINT` set → uses the serverless proxy (production)
2. `VITE_ANTHROPIC_API_KEY` set → calls Anthropic directly (local dev)
3. Neither set → scripted fallback (demo mode, no keys required)

### Alternative: Functions emulator

If you need to test the full proxy path locally (e.g. to test multi-provider
routing or the Function code itself), create `functions/.secret.local` (gitignored)
with your keys and start the emulator:

```bash
# functions/.secret.local
ANTHROPIC_API_KEY=sk-ant-your-key-here

# Start emulator (separate terminal)
cd functions && npm run serve

# In app/frontend/.env, set:
# VITE_AGENT_ENDPOINT=http://127.0.0.1:5001/sgln-team1-f8d61/us-central1/agentChat
# VITE_AGENT_PROVIDER=anthropic
```

## Production setup (one-time)

Requires the Firebase **Blaze** (pay-as-you-go) plan — 2nd-gen functions and
outbound network calls need it.

```bash
# 1. Install deps
cd functions && npm install

# 2. Store whichever provider keys you want available (server-side secrets)
firebase functions:secrets:set ANTHROPIC_API_KEY
firebase functions:secrets:set OPENAI_API_KEY
firebase functions:secrets:set GEMINI_API_KEY

# 3. Deploy the function
firebase deploy --only functions

# 4. Point the frontend at it, then rebuild + deploy hosting
#    app/frontend/.env:
#      VITE_AGENT_ENDPOINT=/api/agent
#      VITE_AGENT_PROVIDER=anthropic
cd ../app/frontend && npm run build && cd ../.. && firebase deploy --only hosting
```

You only need to set the keys for the providers you actually use. A request for
a provider with no configured key returns `503`.

## Updating a secret

To rotate or change a key, run the set command again — it overwrites the existing value:

```bash
firebase functions:secrets:set ANTHROPIC_API_KEY
firebase deploy --only functions
```

## Model overrides (optional)

Defaults: `claude-sonnet-5`, `gpt-4o`, `gemini-2.0-flash`. Override per provider
with environment variables on the function: `ANTHROPIC_MODEL`, `OPENAI_MODEL`,
`GEMINI_MODEL`.

## Demo mode

If `VITE_AGENT_ENDPOINT` is unset, the workspace runs with a built-in scripted
agent — no backend or keys required. This keeps local dev and demos fully
playable; deploy the function and set the env var to switch to a live model.
# Evaluation, credentials, and email

`evaluationApi` provides the shared attempt, evaluator, review, and credential
operations used by `VITE_EVALUATION_API_ENDPOINT=/api/evaluation`.

Evaluator queue reads support optional `caseId`, `status`, `recommendation`,
`submittedAfter`, and `submittedBefore` query parameters. Dates are ISO-8601
timestamps and invalid filters return `400`.

Configure these Firebase secrets:

```bash
firebase functions:secrets:set EVALUATOR_ACCESS_CODE
firebase functions:secrets:set PRIVATE_TOKEN_SECRET
firebase functions:secrets:set EVALUATION_API_KEY
firebase functions:secrets:set EMAIL_DELIVERY_API_KEY
```

Configure these runtime environment values:

- `EVALUATION_ENDPOINT`: provider-neutral structured evaluation endpoint.
- `EVALUATION_PROVIDER`, `EVALUATION_MODEL`, and
  `EVALUATION_PROMPT_VERSION`: evaluation-run lineage.
- `EVALUATION_TIMEOUT_MS`: optional provider timeout; defaults to 90 seconds.
- `EMAIL_DELIVERY_ENDPOINT`: provider-neutral email endpoint accepting
  `{ to, subject, text, html, idempotencyKey }`.
- `EMAIL_DELIVERY_TIMEOUT_MS`: optional email-provider timeout; defaults to
  30 seconds.
- `PUBLIC_APP_URL`: origin used for private credential links.

Attempt submission atomically creates an evaluation job. The
`processEvaluationJob` Firestore trigger runs AI evaluation outside the submit
request, validates the complete structured response, and moves provider errors
or invalid output into the manual-reviewable failure state.

The email worker passes the notification ID both as an idempotency header and
payload field. Provider failures leave a retryable delivery record without
rolling back the final learner outcome. `retryEvaluationNotifications` scans
queued and failed deliveries every five minutes using leases and exponential
backoff. An authenticated evaluator can also requeue a delivery with
`POST /api/evaluation/notifications/:notificationId/retry`.

## Integration test

Run the Firestore and Functions integration suite with Node 22 and Java 21:

```bash
npm run test:emulator
```

The suite uses the demo-only project `demo-sgln-evaluation`, dedicated local
ports, and in-process fake evaluation and email providers. It cannot access
production Firebase services or send real email. It also exercises Firestore
rules through the untrusted REST surface: released simulations are readable,
while unreleased simulations, operational reads, and all direct client writes
remain denied.
