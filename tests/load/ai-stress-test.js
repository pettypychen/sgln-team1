/**
 * Stress test: find the maximum concurrent users each AI provider can handle.
 *
 * Starts at 1 VU and steps up by 5 every 40 s (10 s ramp + 30 s hold).
 * The test STOPS AUTOMATICALLY the moment error rate exceeds 2 % or any
 * request times out — the VU count at that point is the breaking point.
 *
 * Run once per provider to find its limit:
 *
 *   k6 run -e PROVIDER=zai       tests/load/ai-stress-test.js
 *   k6 run -e PROVIDER=alibaba   tests/load/ai-stress-test.js
 *   k6 run -e PROVIDER=openrouter tests/load/ai-stress-test.js
 *
 * At the end of each run, look for:
 *   ✗ chat_errors.............. rate=X%   ← threshold that triggered the abort
 *   vus..................... N             ← concurrent users when it failed
 *
 * The max safe load is the VU hold level BEFORE the abort fired.
 *
 * Optional env vars:
 *   AGENT_ENDPOINT         — defaults to production Firebase Hosting rewrite
 *   FIREBASE_API_KEY       — if set, also writes a Firestore submission per VU
 *   FIRESTORE_SUBMISSIONS_URL — override for emulator testing
 */

import http from "k6/http";
import { sleep, check, group } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";

// ── Configuration ─────────────────────────────────────────────────────────────

const AGENT_ENDPOINT =
  __ENV.AGENT_ENDPOINT ||
  "https://sgln-team1-f8d61.web.app/api/agent";

const PROVIDER = __ENV.PROVIDER || "zai";

const FIREBASE_API_KEY = __ENV.FIREBASE_API_KEY || "";
const FIRESTORE_URL =
  __ENV.FIRESTORE_SUBMISSIONS_URL ||
  "https://firestore.googleapis.com/v1/projects/sgln-team1-f8d61/databases/(default)/documents/submissions";
const IS_EMULATOR =
  FIRESTORE_URL.includes("127.0.0.1") || FIRESTORE_URL.includes("localhost");

// ── Load profile ──────────────────────────────────────────────────────────────
// Steps up by 5 VUs every 40 s (10 s ramp + 30 s hold), 1 → 50.
// abortOnFail stops the test as soon as the error threshold is breached.

export const options = {
  stages: [
    // Baseline
    { duration: "30s", target: 1  },
    // Step 1 → 5
    { duration: "10s", target: 5  },
    { duration: "30s", target: 5  },
    // Step 5 → 10
    { duration: "10s", target: 10 },
    { duration: "30s", target: 10 },
    // Step 10 → 15
    { duration: "10s", target: 15 },
    { duration: "30s", target: 15 },
    // Step 15 → 20
    { duration: "10s", target: 20 },
    { duration: "30s", target: 20 },
    // Step 20 → 25
    { duration: "10s", target: 25 },
    { duration: "30s", target: 25 },
    // Step 25 → 30
    { duration: "10s", target: 30 },
    { duration: "30s", target: 30 },
    // Step 30 → 35
    { duration: "10s", target: 35 },
    { duration: "30s", target: 35 },
    // Step 35 → 40
    { duration: "10s", target: 40 },
    { duration: "30s", target: 40 },
    // Step 40 → 45
    { duration: "10s", target: 45 },
    { duration: "30s", target: 45 },
    // Step 45 → 50
    { duration: "10s", target: 50 },
    { duration: "30s", target: 50 },
    // Ramp down
    { duration: "15s", target: 0  },
  ],
  thresholds: {
    // Abort the entire test the instant error rate crosses 2 %.
    // The VU count shown in the summary is the breaking point.
    chat_errors: [{ threshold: "rate<0.02", abortOnFail: true }],
    http_req_failed: [{ threshold: "rate<0.02", abortOnFail: true }],
    // Track latency — no abort, just informational.
    "http_req_duration{endpoint:agent}": ["p(95)<30000"],
  },
};

// ── Custom metrics ────────────────────────────────────────────────────────────

const chatErrors = new Rate("chat_errors");
const submitErrors = new Rate("submit_errors");
const agentLatency = new Trend("agent_turn_ms");
const rateLimitErrors = new Counter("rate_limit_errors"); // HTTP 429 count

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
// Keep turns short (2–3 per VU) so each step level stabilises quickly.

const PROMPTS_EARLY = [
  "What does Kopi O Kosong mean according to the glossary?",
  "Can you explain what the 'O' and 'Kosong' modifiers mean?",
  "What is the difference between Kopi, Kopi O, and Kopi C?",
  "Aiman wants no milk and no sugar — which glossary terms match?",
];

const PROMPTS_MID = [
  "I think Aiman's order is K03. Can you check that against the menu?",
  "For Beatrice, she wants iced coffee with milk. Is K06 correct?",
  "Cheryl wants evaporated milk and less sugar. Does K05 fit?",
  "Does K03 satisfy Aiman's no-dairy constraint and stay under SGD 2?",
];

const WORK_PRODUCTS = [
  `| Aiman | K03 | Kopi O Kosong | SGD 1.40 |
| Beatrice | K06 | Kopi Peng | SGD 2.00 |
| Cheryl | K05 | Kopi C Siew Dai | SGD 1.70 |
Total: SGD 5.10`,
  `Aiman K03 SGD1.40, Beatrice K06 SGD2.00, Cheryl K05 SGD1.70 — total SGD5.10`,
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function sendTurn(messages) {
  const res = http.post(
    AGENT_ENDPOINT,
    JSON.stringify({ provider: PROVIDER, system: SYSTEM_PROMPT, messages }),
    {
      headers: { "Content-Type": "application/json" },
      timeout: "30s",
      tags: { endpoint: "agent" },
    },
  );

  if (res.status === 429) rateLimitErrors.add(1);

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

  const res = http.post(
    (FIREBASE_API_KEY && !IS_EMULATOR)
      ? `${FIRESTORE_URL}?key=${FIREBASE_API_KEY}`
      : FIRESTORE_URL,
    JSON.stringify({
      fields: {
        caseId: { stringValue: "kopi-run" },
        caseTitle: { stringValue: "Kopi Run" },
        displayName: { stringValue: `Stress Test [${PROVIDER}] VU${vuId}` },
        email: { stringValue: `stress-${PROVIDER}-${vuId}@test.sim` },
        workProduct: { stringValue: workProduct },
        evaluationStatus: { stringValue: "pending_ai_processing" },
        submittedAt: { timestampValue: new Date().toISOString() },
      },
    }),
    { headers: { "Content-Type": "application/json" }, tags: { endpoint: "firestore" } },
  );

  submitErrors.add(!check(res, { "firestore 200": (r) => r.status === 200 }));
}

// ── Virtual-user scenario ─────────────────────────────────────────────────────

export default function () {
  const vuId = String(__VU).padStart(3, "0");
  const messages = [];

  group("chat phase", () => {
    // Turn 1 — early question
    messages.push({ role: "user", content: pick(PROMPTS_EARLY) });
    const reply1 = sendTurn(messages);
    if (reply1) messages.push({ role: "assistant", content: reply1 });
    sleep(randBetween(1, 2));

    // Turn 2 — mid question
    messages.push({ role: "user", content: pick(PROMPTS_MID) });
    const reply2 = sendTurn(messages);
    if (reply2) messages.push({ role: "assistant", content: reply2 });
    sleep(randBetween(1, 2));
  });

  group("submit work product", () => {
    submitWork(vuId, pick(WORK_PRODUCTS));
  });

  sleep(randBetween(0.5, 1.5));
}
