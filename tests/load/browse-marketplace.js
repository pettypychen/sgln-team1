/**
 * Load test: 100 concurrent users browsing the SimWorks marketplace.
 *
 * Each virtual user simulates a participant session after login:
 *   1. Land on the marketplace  (Firebase Hosting → index.html)
 *   2. Fetch the agentChat provider list  (Cloud Function GET /api/agent)
 *   3. Open a random simulation detail page
 *   4. Optionally read the simulation document from Firestore REST API
 *   5. Navigate back to the marketplace
 *
 * Because the frontend is a React SPA, every HTML route returns the same
 * index.html from the CDN. The Firestore reads below replicate what the
 * Firebase SDK would normally do in the browser.
 *
 * Usage:
 *   k6 run tests/load/browse-marketplace.js
 *
 * With Firestore reads (requires the project's public API key):
 *   k6 run -e FIREBASE_API_KEY=AIza... tests/load/browse-marketplace.js
 *
 * Against a staging URL:
 *   k6 run -e BASE_URL=https://your-staging-app.web.app tests/load/browse-marketplace.js
 */

import http from "k6/http";
import { sleep, check, group } from "k6";
import { Rate, Trend } from "k6/metrics";

// ── Configuration ─────────────────────────────────────────────────────────────

const BASE_URL = __ENV.BASE_URL || "https://sgln-team1-f8d61.web.app";
const FIREBASE_API_KEY = __ENV.FIREBASE_API_KEY || "";
const FIRESTORE_BASE =
  "https://firestore.googleapis.com/v1/projects/sgln-team1-f8d61/databases/(default)/documents";

// All released simulation case IDs. Add new ones as cases are published.
const CASE_IDS = [
  "first-year-associate-ma-due-diligence",
  "month-end-close-under-pressure",
  "requirements-gathering-workshop",
  "kopi-run",
];

// ── Load profile ──────────────────────────────────────────────────────────────

export const options = {
  stages: [
    { duration: "30s", target: 25 },  // ramp up to 25 users
    { duration: "30s", target: 100 }, // ramp up to 100 users
    { duration: "60s", target: 100 }, // hold at 100 users for 1 minute
    { duration: "30s", target: 0 },   // ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<3000"], // 95th percentile under 3 s
    http_req_failed: ["rate<0.01"],    // < 1 % HTTP errors
    page_errors: ["rate<0.01"],        // < 1 % failed checks
  },
};

// ── Custom metrics ────────────────────────────────────────────────────────────

const pageErrors = new Rate("page_errors");
const firestoreErrors = new Rate("firestore_errors");
const hostingLatency = new Trend("hosting_latency_ms");

// ── Helpers ───────────────────────────────────────────────────────────────────

function pickCase() {
  return CASE_IDS[Math.floor(Math.random() * CASE_IDS.length)];
}

function firestoreGet(docPath) {
  const key = FIREBASE_API_KEY ? `?key=${FIREBASE_API_KEY}` : "";
  return http.get(`${FIRESTORE_BASE}/${docPath}${key}`, {
    tags: { layer: "firestore" },
  });
}

// ── Virtual-user scenario ─────────────────────────────────────────────────────

export default function () {
  // 1. Marketplace landing page
  group("marketplace", () => {
    const res = http.get(BASE_URL, { tags: { page: "marketplace" } });
    const ok = check(res, {
      "marketplace status 200": (r) => r.status === 200,
      "marketplace has html": (r) =>
        r.body !== null && r.body.includes("<!DOCTYPE html"),
    });
    pageErrors.add(!ok);
    hostingLatency.add(res.timings.duration, { page: "marketplace" });
  });

  sleep(Math.random() * 2 + 1); // 1–3 s browsing the simulation list

  // 2. Agent provider list — fetched by the simulation page on mount
  group("agent provider list", () => {
    const res = http.get(`${BASE_URL}/api/agent`, {
      tags: { page: "agent_providers" },
    });
    const ok = check(res, {
      "providers status 200": (r) => r.status === 200,
    });
    pageErrors.add(!ok);
  });

  // 3. Open a random simulation detail page (SPA route — returns index.html)
  const caseId = pickCase();
  group("simulation detail page", () => {
    const res = http.get(`${BASE_URL}/simulations/${caseId}`, {
      tags: { page: "simulation" },
    });
    const ok = check(res, {
      "simulation status 200": (r) => r.status === 200,
    });
    pageErrors.add(!ok);
    hostingLatency.add(res.timings.duration, { page: "simulation" });
  });

  // 4. Firestore read — fetch the simulation document (optional; mirrors what
  //    the Firebase SDK does when the simulation detail page loads)
  if (FIREBASE_API_KEY) {
    group("firestore simulation doc", () => {
      const res = firestoreGet(`simulations/${caseId}`);
      // 200 = document found and readable; 403 = not released (expected for
      // unreleased cases); anything else is a failure.
      const ok = check(res, {
        "firestore doc readable": (r) => r.status === 200 || r.status === 403,
      });
      firestoreErrors.add(!ok);
    });
  }

  sleep(Math.random() * 3 + 2); // 2–5 s reading the simulation detail

  // 5. Navigate back to the marketplace
  group("return to marketplace", () => {
    const res = http.get(`${BASE_URL}/`, {
      tags: { page: "marketplace_return" },
    });
    const ok = check(res, {
      "return status 200": (r) => r.status === 200,
    });
    pageErrors.add(!ok);
    hostingLatency.add(res.timings.duration, { page: "marketplace_return" });
  });

  sleep(Math.random() * 1 + 0.5); // 0.5–1.5 s before next iteration
}
