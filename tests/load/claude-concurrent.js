/**
 * Load test: 20 concurrent users hitting the Claude (Anthropic) provider.
 *
 * Goal: detect whether Anthropic rate-limits at 20 concurrent users.
 * Each VU sends 3–5 chat turns with 1–3 s think time between turns,
 * then submits a Firestore work product — identical scenario to
 * kopi-run-submission.js but scoped to Claude and capped at 20 VUs.
 *
 * Watch for:
 *   - rate_limit_errors  > 0  → Anthropic returned HTTP 429
 *   - chat_errors rate   > 5% → general AI failures (timeouts, 5xx)
 *   - agent_turn_ms p95  high → Claude slower than other providers
 *
 * Prerequisites:
 *   - AGENT_ENDPOINT — URL for the agentChat Cloud Function.
 *                      Defaults to the production Firebase Hosting rewrite.
 *   - FIREBASE_API_KEY — public Firebase web API key (from app/frontend/.env).
 *                        Required for the Firestore submission step.
 *
 * Usage:
 *   # Chat only (no Firestore writes)
 *   k6 run tests/load/claude-concurrent.js
 *
 *   # Full flow including Firestore submissions
 *   k6 run -e FIREBASE_API_KEY=AIza... tests/load/claude-concurrent.js
 *
 *   # Against local Cloud Function emulator
 *   k6 run -e AGENT_ENDPOINT=http://127.0.0.1:5101/sgln-team1-f8d61/us-central1/agentChat \
 *           -e FIREBASE_API_KEY=AIza... \
 *           tests/load/claude-concurrent.js
 *
 * Cost note:
 *   20 VUs × avg 4 turns = ~80 Anthropic API calls per run.
 *   Claude Sonnet tokens cost more than Z.ai/Qwen — run emulator first if
 *   you only want to verify infrastructure (emulator won't call the real API).
 */

import http from "k6/http";
import { sleep, check, group } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";

// ── Configuration ─────────────────────────────────────────────────────────────

const AGENT_ENDPOINT =
  __ENV.AGENT_ENDPOINT ||
  "https://sgln-team1-f8d61.web.app/api/agent";

const PROVIDER = __ENV.PROVIDER || "anthropic";

const FIREBASE_API_KEY = __ENV.FIREBASE_API_KEY || "";
const FIRESTORE_URL =
  __ENV.FIRESTORE_SUBMISSIONS_URL ||
  "https://firestore.googleapis.com/v1/projects/sgln-team1-f8d61/databases/(default)/documents/submissions";
const IS_EMULATOR =
  FIRESTORE_URL.includes("127.0.0.1") || FIRESTORE_URL.includes("localhost");

// ── Load profile ──────────────────────────────────────────────────────────────

export const options = {
  stages: [
    { duration: "20s", target: 10 },  // ramp to half load
    { duration: "20s", target: 20 },  // ramp to full 20 VUs
    { duration: "90s", target: 20 },  // hold — long enough to detect 429s
    { duration: "15s", target: 0 },   // ramp down
  ],
  thresholds: {
    // Claude should respond within 20 s (longer context = slower)
    "http_req_duration{endpoint:agent}": ["p(95)<20000"],
    // Firestore writes should remain fast
    "http_req_duration{endpoint:firestore}": ["p(95)<3000"],
    // Zero tolerance for rate-limit errors
    rate_limit_errors: ["count<1"],
    // Allow up to 5% general errors (timeouts, etc.)
    chat_errors: ["rate<0.05"],
  },
};

// ── Custom metrics ────────────────────────────────────────────────────────────

const chatErrors = new Rate("chat_errors");
const submitErrors = new Rate("submit_errors");
const agentLatency = new Trend("agent_turn_ms");
const rateLimitErrors = new Counter("rate_limit_errors"); // counts HTTP 429s

// ── Kopi Run system prompt ────────────────────────────────────────────────────

const SYSTEM_PROMPT = `---
slug: kopi-run
caseVersion: 1.0.0
---

# Kopi Run

Prepare a kopi order for three colleagues at fictional Crimson Cup Kopitiam.

## What to do
1. Read the three colleague orders.
2. Use the glossary and menu to match each order to an item code.
3. Ask the AI to check at least one match.
4. Add the three prices and submit the total.

## Final format
| Colleague | Item code | Translated order | Price |
| --- | --- | --- | --- |
End with the total in SGD.

Source artifacts:
## kopi-menu.csv
Item code,Drink name,Base drink,Milk modifier,Sugar modifier,Temperature or ice modifier,Availability,Price in SGD
K01,Kopi,Coffee,Condensed milk,Standard sugar,Hot,Available,1.60
K02,Kopi O,Coffee,No milk,Standard sugar,Hot,Available,1.40
K03,Kopi O Kosong,Coffee,No milk,No sugar,Hot,Available,1.40
K04,Kopi C,Coffee,Evaporated milk,Standard sugar,Hot,Available,1.70
K05,Kopi C Siew Dai,Coffee,Evaporated milk,Less sugar,Hot,Available,1.70
K06,Kopi Peng,Coffee,Condensed milk,Standard sugar,Iced,Available,2.00

## colleague-orders.csv
Display name,Plain-language preference,Dietary or ingredient constraint,Budget note
Aiman,Strong hot coffee with no milk and no sugar,No dairy,Under SGD 2
Beatrice,Iced coffee with milk and normal sweetness,None,None
Cheryl,Hot coffee with evaporated milk and less sugar,Avoid condensed milk,None

## kopi-glossary.md
# Crimson Cup glossary
- Kopi: coffee with condensed milk and standard sugar.
- O: no milk.
- C: evaporated milk instead of condensed milk.
- Kosong: no sugar.
- Siew dai: less sugar.
- Peng: iced.

Coach without revealing the complete answer. Ground claims in supplied sources.`;

// ── Prompt pools ──────────────────────────────────────────────────────────────

const PROMPTS_EARLY = [
  "What does Kopi O Kosong mean according to the glossary?",
  "Can you explain what the 'O' and 'Kosong' modifiers mean?",
  "What is the difference between Kopi, Kopi O, and Kopi C?",
  "I am looking at Aiman's order — he wants no milk and no sugar. Which glossary terms match?",
];

const PROMPTS_MID = [
  "I think Aiman's order is K03 because he wants no milk and no sugar. Can you check that against the menu?",
  "For Beatrice, she wants iced coffee with milk. Is K06 correct? It says condensed milk and iced.",
  "Cheryl wants evaporated milk and less sugar. I am considering K05. Does the menu support that?",
  "Can you confirm whether K03 fits Aiman's constraint of no dairy and under SGD 2?",
  "Does K05 avoid condensed milk as Cheryl requires?",
];

const PROMPTS_LATE = [
  "I have Aiman as K03 (SGD 1.40), Beatrice as K06 (SGD 2.00), and Cheryl as K05 (SGD 1.70). Can you verify the total?",
  "My total is SGD 5.10 for all three orders. Is the arithmetic correct based on the menu prices?",
  "Here is my table: Aiman K03, Beatrice K06, Cheryl K05 — total SGD 5.10. Does anything look wrong?",
];

const WORK_PRODUCTS = [
  `| Colleague | Item code | Translated order | Price |
| --- | --- | --- | --- |
| Aiman | K03 | Kopi O Kosong | SGD 1.40 |
| Beatrice | K06 | Kopi Peng | SGD 2.00 |
| Cheryl | K05 | Kopi C Siew Dai | SGD 1.70 |

Total: SGD 5.10`,

  `Aiman | K03 | Kopi O Kosong | SGD 1.40
Beatrice | K06 | Kopi Peng | SGD 2.00
Cheryl | K05 | Kopi C Siew Dai | SGD 1.70
Total SGD 5.10`,

  `Orders:
- Aiman: K03 (Kopi O Kosong) — SGD 1.40
- Beatrice: K06 (Kopi Peng) — SGD 2.00
- Cheryl: K05 (Kopi C Siew Dai) — SGD 1.70
Grand total: SGD 5.10`,
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function sendTurn(messages) {
  const payload = JSON.stringify({
    provider: PROVIDER,
    system: SYSTEM_PROMPT,
    messages,
  });

  const res = http.post(AGENT_ENDPOINT, payload, {
    headers: { "Content-Type": "application/json" },
    timeout: "45s",
    tags: { endpoint: "agent" },
  });

  // Track 429s separately so they're visible in the summary
  if (res.status === 429) {
    rateLimitErrors.add(1);
  }

  const ok = check(res, {
    "agent 200": (r) => r.status === 200,
    "agent has content": (r) => {
      try { return Boolean(JSON.parse(r.body).content); } catch { return false; }
    },
  });

  chatErrors.add(!ok);
  agentLatency.add(res.timings.duration);

  if (!ok) return "";
  try { return JSON.parse(res.body).content || ""; } catch { return ""; }
}

function submitWork(vuId, workProduct) {
  if (!FIREBASE_API_KEY && !IS_EMULATOR) return;

  const now = new Date().toISOString();
  const payload = JSON.stringify({
    fields: {
      caseId: { stringValue: "kopi-run" },
      caseTitle: { stringValue: "Kopi Run" },
      displayName: { stringValue: `Claude Load Test User ${vuId}` },
      email: { stringValue: `claude-loadtest-${vuId}@test.sim` },
      workProduct: { stringValue: workProduct },
      evaluationStatus: { stringValue: "pending_ai_processing" },
      submittedAt: { timestampValue: now },
    },
  });

  const url = (FIREBASE_API_KEY && !IS_EMULATOR)
    ? `${FIRESTORE_URL}?key=${FIREBASE_API_KEY}`
    : FIRESTORE_URL;

  const res = http.post(url, payload, {
    headers: { "Content-Type": "application/json" },
    tags: { endpoint: "firestore" },
  });

  submitErrors.add(!check(res, { "firestore 200": (r) => r.status === 200 }));
}

// ── Virtual-user scenario ─────────────────────────────────────────────────────

export default function () {
  const vuId = String(__VU).padStart(3, "0");
  const numTurns = Math.floor(randBetween(3, 6)); // 3–5 turns
  const messages = [];

  group("chat phase", () => {
    for (let turn = 0; turn < numTurns; turn++) {
      let prompt;
      if (turn === 0) {
        prompt = pick(PROMPTS_EARLY);
      } else if (turn < numTurns - 1) {
        prompt = pick(PROMPTS_MID);
      } else {
        prompt = pick(PROMPTS_LATE);
      }

      group(`turn ${turn + 1}`, () => {
        messages.push({ role: "user", content: prompt });
        const reply = sendTurn(messages);
        if (reply) messages.push({ role: "assistant", content: reply });
      });

      sleep(randBetween(1, 3));
    }
  });

  group("submit work product", () => {
    submitWork(vuId, pick(WORK_PRODUCTS));
  });

  sleep(randBetween(0.5, 1.5));
}
