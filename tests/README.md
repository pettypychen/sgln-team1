# SimWorks Load Tests

Load tests for the SimWorks platform using [k6](https://k6.io/).

## Setup

Install k6 once on your machine:

- **Windows** — `winget install k6 --source winget`
- **macOS** — `brew install k6`
- **Linux** — see [k6 Linux install docs](https://k6.io/docs/get-started/installation/)

## Running tests

All tests are run from the repo root.

### Browse marketplace (100 concurrent users)

Simulates 100 users landing on the marketplace, clicking into simulation pages,
and navigating back. Mirrors the session after the participant login screen.

```sh
k6 run tests/load/browse-marketplace.js
```

**With Firestore reads** (closer to real browser behaviour — reads the
simulation documents that the React app would normally fetch via the Firebase
SDK):

```sh
k6 run -e FIREBASE_API_KEY=your-key tests/load/browse-marketplace.js
```

The Firebase API key is in `app/frontend/.env` as `VITE_FIREBASE_API_KEY`.
It is a public client-side key — safe to pass on the command line.

**Against a different environment:**

```sh
k6 run -e BASE_URL=https://your-staging-project.web.app tests/load/browse-marketplace.js
```

## Available tests

| File | Description | Peak VUs |
|---|---|---|
| `load/browse-marketplace.js` | Post-login marketplace + simulation browsing | 100 |
| `load/kopi-run-submission.js` | Full Kopi Run session: AI chat (3–5 turns via Z.ai) + Firestore submission | 100 |
| `load/claude-concurrent.js` | Same Kopi Run scenario against Claude (Anthropic) — rate-limit detection | 10 |

### Kopi Run submission test

```sh
# AI chat only — no data written to Firestore
k6 run tests/load/kopi-run-submission.js

# Full flow — writes real submissions to Firestore (shows up in the evaluator queue)
k6 run -e FIREBASE_API_KEY=AIza... tests/load/kopi-run-submission.js

# Against local Cloud Function emulator (recommended before hitting live Z.ai at scale)
k6 run -e AGENT_ENDPOINT=http://127.0.0.1:5101/sgln-team1-f8d61/us-central1/agentChat \
       -e FIREBASE_API_KEY=AIza... \
       tests/load/kopi-run-submission.js
```

> **Cost note** — 100 VUs × ~4 turns = ~400 Z.ai API calls per run. Test against the
> Firebase emulator first (`firebase emulators:start --only functions,firestore`) to verify
> behaviour without incurring API costs. Submissions written to production will appear in
> the evaluator queue with email addresses like `loadtest-001@test.sim`.

### Claude concurrent test (rate-limit detection)

```sh
# Chat only — watch for rate_limit_errors counter in the summary
k6 run tests/load/claude-concurrent.js

# Full flow including Firestore submissions
k6 run -e FIREBASE_API_KEY=AIza... tests/load/claude-concurrent.js

# Against local emulator (no real Anthropic calls — infrastructure check only)
k6 run -e AGENT_ENDPOINT=http://127.0.0.1:5101/sgln-team1-f8d61/us-central1/agentChat \
       -e FIREBASE_API_KEY=AIza... \
       tests/load/claude-concurrent.js
```

Key metric to watch: **`rate_limit_errors`** — this counter increments on every HTTP 429
from Anthropic. The threshold is set to `count<1` so the test fails immediately if any
rate limiting is detected. Also watch `agent_turn_ms p95` to compare Claude latency
against Z.ai and Alibaba Qwen results.

> **Cost note** — 10 VUs × ~4 turns = ~40 Claude Sonnet API calls per run.
> Claude Sonnet is more expensive per call than Z.ai/Qwen — run against the emulator
> first if you only need to verify infrastructure.

## Reading k6 output

Key metrics to watch:

| Metric | Threshold | Meaning |
|---|---|---|
| `http_req_duration p(95)` | < 3 000 ms | 95th-percentile response time |
| `http_req_failed rate` | < 1 % | HTTP error rate |
| `page_errors rate` | < 1 % | Failed status/body checks |
| `hosting_latency_ms` | — | Per-page Firebase Hosting latency breakdown |
| `agent_turn_ms` | — | Per-turn Z.ai response time |
| `chat_errors rate` | < 5 % | Failed agent turns (AI errors / timeouts) |
| `submit_errors rate` | < 1 % | Failed Firestore submission writes |
