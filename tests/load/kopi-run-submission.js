/**
 * Load test: 100 concurrent users completing the Kopi Run simulation.
 *
 * Each virtual user mirrors what a real participant does on
 * /simulations/kopi-run:
 *   1. Send 3–5 chat turns to the Z.ai agentChat Cloud Function
 *      (1–3 s think time between turns)
 *   2. Submit a work-product table to Firestore
 *
 * Prerequisites:
 *   - AGENT_ENDPOINT  — URL for the agentChat Cloud Function.
 *                       Defaults to the production Firebase Hosting rewrite.
 *   - FIREBASE_API_KEY — Public Firebase web API key (from app/frontend/.env).
 *                       Required for the Firestore submission step.
 *
 * Usage:
 *   # AI chat only (no submissions written to Firestore)
 *   k6 run tests/load/kopi-run-submission.js
 *
 *   # Full flow including Firestore submissions
 *   k6 run -e FIREBASE_API_KEY=AIza... tests/load/kopi-run-submission.js
 *
 *   # Against local emulator (Cloud Functions on port 5101)
 *   k6 run -e AGENT_ENDPOINT=http://127.0.0.1:5101/sgln-team1-f8d61/us-central1/agentChat \
 *           -e FIREBASE_API_KEY=AIza... \
 *           tests/load/kopi-run-submission.js
 *
 * Cost warning:
 *   100 VUs × avg 4 turns = ~400 Z.ai API calls. Run against the emulator
 *   first to verify behaviour before hitting the live AI provider at scale.
 *   Submissions created in production will appear in the evaluator queue.
 */

import http from "k6/http";
import { sleep, check, group } from "k6";
import { Rate, Trend } from "k6/metrics";

// ── Configuration ─────────────────────────────────────────────────────────────

const AGENT_ENDPOINT =
  __ENV.AGENT_ENDPOINT ||
  "https://sgln-team1-f8d61.web.app/api/agent";

// AI provider to use: "zai" | "alibaba" | "openrouter"
const PROVIDER = __ENV.PROVIDER || "zai";

const FIREBASE_API_KEY = __ENV.FIREBASE_API_KEY || "";
// Override with emulator URL for local testing:
//   -e FIRESTORE_SUBMISSIONS_URL=http://127.0.0.1:8180/v1/projects/sgln-team1-f8d61/databases/(default)/documents/submissions
const FIRESTORE_URL =
  __ENV.FIRESTORE_SUBMISSIONS_URL ||
  "https://firestore.googleapis.com/v1/projects/sgln-team1-f8d61/databases/(default)/documents/submissions";
const IS_EMULATOR = FIRESTORE_URL.includes("127.0.0.1") || FIRESTORE_URL.includes("localhost");

// ── Load profile ──────────────────────────────────────────────────────────────

export const options = {
  stages: [
    { duration: "30s", target: 25 },  // ramp up
    { duration: "30s", target: 100 }, // reach peak
    { duration: "60s", target: 100 }, // hold at 100 concurrent users
    { duration: "30s", target: 0 },   // ramp down
  ],
  thresholds: {
    // AI endpoint should respond within 15 s (Z.ai may be slow under load)
    "http_req_duration{endpoint:agent}": ["p(95)<15000"],
    // Firestore writes should be fast
    "http_req_duration{endpoint:firestore}": ["p(95)<3000"],
    http_req_failed: ["rate<0.05"], // tolerate up to 5 % errors under AI load
    chat_errors: ["rate<0.05"],
  },
};

// ── Custom metrics ────────────────────────────────────────────────────────────

const chatErrors = new Rate("chat_errors");
const submitErrors = new Rate("submit_errors");
const agentLatency = new Trend("agent_turn_ms");

// ── Kopi Run system prompt ────────────────────────────────────────────────────
// Mirrors the prompt the frontend builds from content/simulations/kopi-run/

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
// Grouped by conversation stage so each VU has a natural arc.

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

// Final submitted work products (varied slightly across VUs)
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

/** POST one turn to the agentChat function and return the AI reply text. */
function sendTurn(messages) {
  const payload = JSON.stringify({
    provider: PROVIDER,
    system: SYSTEM_PROMPT,
    messages: messages,
  });

  const res = http.post(AGENT_ENDPOINT, payload, {
    headers: { "Content-Type": "application/json" },
    timeout: "30s",
    tags: { endpoint: "agent" },
  });

  const ok = check(res, {
    "agent 200": (r) => r.status === 200,
    "agent has content": (r) => {
      try {
        return Boolean(JSON.parse(r.body).content);
      } catch {
        return false;
      }
    },
  });
  chatErrors.add(!ok);
  agentLatency.add(res.timings.duration);

  if (!ok) return "";
  try {
    return JSON.parse(res.body).content || "";
  } catch {
    return "";
  }
}

/** POST a submission document to Firestore via REST API. */
function submitWork(vuId, workProduct) {
  // Require API key for production; emulator works without one.
  if (!FIREBASE_API_KEY && !IS_EMULATOR) return;

  const now = new Date().toISOString();
  const payload = JSON.stringify({
    fields: {
      caseId: { stringValue: "kopi-run" },
      caseTitle: { stringValue: "Kopi Run" },
      displayName: { stringValue: `Load Test User ${vuId}` },
      email: { stringValue: `loadtest-${vuId}@test.sim` },
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

  const ok = check(res, {
    "firestore submission 200": (r) => r.status === 200,
  });
  submitErrors.add(!ok);
}

// ── Virtual-user scenario ─────────────────────────────────────────────────────

export default function () {
  const vuId = String(__VU).padStart(3, "0");
  const numTurns = Math.floor(randBetween(3, 6)); // 3–5 turns
  const messages = [];

  // ── Chat phase ────────────────────────────────────────────────────────────

  for (let turn = 0; turn < numTurns; turn++) {
    let prompt;
    if (turn === 0) {
      prompt = pick(PROMPTS_EARLY);
    } else if (turn < numTurns - 1) {
      prompt = pick(PROMPTS_MID);
    } else {
      prompt = pick(PROMPTS_LATE);
    }

    group(`chat turn ${turn + 1}`, () => {
      messages.push({ role: "user", content: prompt });
      const reply = sendTurn(messages);
      if (reply) {
        messages.push({ role: "assistant", content: reply });
      }
    });

    sleep(randBetween(1, 3)); // 1–3 s think time between turns
  }

  // ── Submission phase ──────────────────────────────────────────────────────

  group("submit work product", () => {
    submitWork(vuId, pick(WORK_PRODUCTS));
  });

  sleep(randBetween(0.5, 1.5));
}
