import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CASE_DEFINITIONS } from "../src/evaluation/rubrics.ts";

const root = resolve(import.meta.dirname, "../src/content/simulations");

for (const definition of CASE_DEFINITIONS.filter((item) => item.released)) {
  const caseRoot = resolve(root, definition.id);
  const caseMarkdown = readFileSync(resolve(caseRoot, "case.md"), "utf8");
  const evaluationMarkdown = readFileSync(
    resolve(caseRoot, "evaluation.md"),
    "utf8",
  );
  const rubric = JSON.parse(
    readFileSync(resolve(caseRoot, "rubric.json"), "utf8"),
  ) as {
    caseId: string;
    caseVersion: string;
    rubricVersion: string;
    caseThreshold: number;
    interactionThreshold: number;
    criteria: Array<{
      id: string;
      dimension: string;
      label: string;
      description: string;
      maxPoints: number;
      criticalFailure?: boolean;
    }>;
  };

  assert.equal(rubric.caseId, definition.id);
  assert.equal(rubric.caseVersion, definition.version);
  assert.equal(rubric.rubricVersion, definition.rubric.rubricVersion);
  assert.equal(rubric.caseThreshold, definition.rubric.caseThreshold);
  assert.equal(
    rubric.interactionThreshold,
    definition.rubric.interactionThreshold,
  );
  assert.deepEqual(
    rubric.criteria.map((criterion) => criterion.id),
    definition.rubric.criteria.map((criterion) => criterion.id),
  );
  assert.deepEqual(
    rubric.criteria.map((criterion) => ({
      ...criterion,
      criticalFailure: Boolean(criterion.criticalFailure),
    })),
    definition.rubric.criteria,
  );
  assert.match(caseMarkdown, /caseVersion:\s*1\.0\.0/);
  assert.match(evaluationMarkdown, /(?:caseVersion|caseVersion:)\s*1\.0\.0/);
  assert.match(evaluationMarkdown, /rubricVersion:\s*1\.0\.0/);
  assert.match(
    readFileSync(resolve(caseRoot, "coaching.md"), "utf8"),
    /coaching prompt/i,
  );
  assert.match(
    readFileSync(resolve(caseRoot, "evaluation-prompt.md"), "utf8"),
    /version 1\.0\.0/i,
  );
}

const ledger = readFileSync(
  resolve(root, "month-end-close-under-pressure/general-ledger.csv"),
  "utf8",
);
assert.equal(ledger.trim().split("\n").length - 1, 30);
for (const plantedReference of [
  "INV-NQ-109",
  "AUG-001",
  "Unposted",
  "INV-TP-992",
  "FA-2026-07",
]) {
  assert.ok(ledger.includes(plantedReference), `missing ${plantedReference}`);
}
const closeEvaluation = readFileSync(
  resolve(root, "month-end-close-under-pressure/evaluation.md"),
  "utf8",
);
assert.match(closeEvaluation, /Fixed exception set/);
assert.match(closeEvaluation, /SGD 11,000 prepaid/);

const orders = readFileSync(
  resolve(root, "kopi-run/colleague-orders.csv"),
  "utf8",
);
assert.equal(orders.trim().split("\n").length - 1, 3);
const menu = readFileSync(resolve(root, "kopi-run/kopi-menu.csv"), "utf8");
for (const expectedItem of ["K03,Kopi O Kosong", "K05,Kopi C Siew Dai", "K06,Kopi Peng"]) {
  assert.ok(menu.includes(expectedItem), `menu missing ${expectedItem}`);
}
const glossary = readFileSync(
  resolve(root, "kopi-run/kopi-glossary.md"),
  "utf8",
);
for (const term of ["Kosong", "Siew dai", "Peng"]) {
  assert.ok(glossary.includes(term), `glossary missing ${term}`);
}
const kopiEvaluation = readFileSync(
  resolve(root, "kopi-run/evaluation.md"),
  "utf8",
);
assert.match(kopiEvaluation, /SGD 5\.10/);

const businessAnalyst = CASE_DEFINITIONS.find(
  (item) => item.id === "requirements-gathering-workshop",
);
assert.equal(
  businessAnalyst?.released,
  false,
  "Business Analyst release must remain blocked pending colleague content",
);

const socialCard = readFileSync(
  resolve(import.meta.dirname, "../public/credential-social-card.png"),
);
assert.deepEqual(
  [...socialCard.subarray(0, 8)],
  [137, 80, 78, 71, 13, 10, 26, 10],
  "social preview must be a real PNG",
);
assert.equal(socialCard.readUInt32BE(16), 1200);
assert.equal(socialCard.readUInt32BE(20), 630);

console.log("prototype case pack: all checks passed");
