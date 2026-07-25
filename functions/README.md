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

## One-time setup

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

## Model overrides (optional)

Defaults: `claude-sonnet-5`, `gpt-4o`, `gemini-2.0-flash`. Override per provider
with environment variables on the function: `ANTHROPIC_MODEL`, `OPENAI_MODEL`,
`GEMINI_MODEL`.

## Demo mode

If `VITE_AGENT_ENDPOINT` is unset, the workspace runs with a built-in scripted
agent — no backend or keys required. This keeps local dev and demos fully
playable; deploy the function and set the env var to switch to a live model.
