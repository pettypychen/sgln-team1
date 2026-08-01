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

## Reading k6 output

Key metrics to watch:

| Metric | Threshold | Meaning |
|---|---|---|
| `http_req_duration p(95)` | < 3 000 ms | 95th-percentile response time |
| `http_req_failed rate` | < 1 % | HTTP error rate |
| `page_errors rate` | < 1 % | Failed status/body checks |
| `hosting_latency_ms` | — | Per-page Firebase Hosting latency breakdown |
