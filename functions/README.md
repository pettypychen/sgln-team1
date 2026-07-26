# SimWorks Functions

Firebase Functions (2nd gen) that keep all API keys server-side. The frontend is a static site and must never ship a key to the browser.

## Agent proxy

`POST /api/agent` (Hosting rewrite → `agentChat` function)

```jsonc
// request
{
  "provider": "anthropic",   // "anthropic" | "openai" | "gemini" | "zai" | "alibaba" | "deepseek"
  "system": "…system prompt…",
  "messages": [{ "role": "user", "content": "…" }]
}
// response
{ "content": "…assistant reply…" }
```

### Local dev

Add your keys to `app/frontend/.env` (gitignored). The Vite dev proxy injects them server-side — no Functions emulator needed.

```bash
# app/frontend/.env
VITE_ANTHROPIC_API_KEY=sk-ant-your-key-here
# VITE_OPENAI_API_KEY=sk-your-key-here
# VITE_GOOGLE_API_KEY=your-key-here
# VITE_ZAI_API_KEY=your-key-here
# VITE_ALIBABA_API_KEY=your-key-here
# VITE_DEEPSEEK_API_KEY=your-key-here
```

### Production

Store keys as Firebase secrets, then deploy:

```bash
firebase functions:secrets:set ANTHROPIC_API_KEY
firebase functions:secrets:set OPENAI_API_KEY
firebase functions:secrets:set GEMINI_API_KEY
firebase functions:secrets:set ZAI_API_KEY
firebase functions:secrets:set ALIBABA_API_KEY
firebase functions:secrets:set DEEPSEEK_API_KEY

firebase deploy --only functions
```

Only set the keys for providers you actually use. A request for a provider with no configured key returns `503`.

To rotate a key, run `firebase functions:secrets:set <KEY>` again and redeploy.

### Model overrides (optional)

Defaults: `claude-sonnet-5`, `gpt-4o`, `gemini-2.0-flash`. Override per provider with environment variables on the function: `ANTHROPIC_MODEL`, `OPENAI_MODEL`, `GEMINI_MODEL`.

## Evaluation, credentials, and email

`evaluationApi` provides the shared attempt, evaluator, review, and credential operations used by `VITE_EVALUATION_API_ENDPOINT=/api/evaluation`.

### Production secrets

```bash
firebase functions:secrets:set EVALUATOR_ACCESS_CODE
firebase functions:secrets:set PRIVATE_TOKEN_SECRET
firebase functions:secrets:set EVALUATION_API_KEY
firebase functions:secrets:set EMAIL_DELIVERY_API_KEY
```

### Runtime environment values

- `EVALUATION_ENDPOINT` — provider-neutral structured evaluation endpoint.
- `EVALUATION_PROVIDER`, `EVALUATION_MODEL`, `EVALUATION_PROMPT_VERSION` — evaluation-run lineage.
- `EVALUATION_TIMEOUT_MS` — optional provider timeout; defaults to 90 seconds.
- `EMAIL_DELIVERY_ENDPOINT` — provider-neutral email endpoint accepting `{ to, subject, text, html, idempotencyKey }`.
- `EMAIL_DELIVERY_TIMEOUT_MS` — optional email-provider timeout; defaults to 30 seconds.
- `PUBLIC_APP_URL` — origin used for private credential links.

## Integration tests (CI)

The full emulator suite runs in CI via `.github/workflows/prd-verification.yml`. To run locally with Node 22 and Java 21:

```bash
npm run test:emulator
```
