"use strict";

const { mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const { resolve } = require("node:path");

const frontendRoot = resolve(
  __dirname,
  "../../app/frontend/src/content/simulations",
);
const output = resolve(__dirname, "../generated/cases.json");

const definitions = [
  {
    id: "first-year-associate-ma-due-diligence",
    title: "First-Year Associate: M&A Due Diligence",
    category: "Legal",
    artifacts: [{ id: "agreement-packet.md", file: "case.md" }],
  },
  {
    id: "month-end-close-under-pressure",
    title: "Month-End Close Under Pressure",
    category: "Accounting",
    artifacts: [
      { id: "general-ledger.csv", file: "general-ledger.csv" },
      { id: "close-checklist.csv", file: "close-checklist.csv" },
      { id: "manager-notes.md", file: "manager-notes.md" },
    ],
  },
  {
    id: "kopi-run",
    title: "Kopi Run",
    category: "Onboarding",
    artifacts: [
      { id: "kopi-menu.csv", file: "kopi-menu.csv" },
      { id: "colleague-orders.csv", file: "colleague-orders.csv" },
      { id: "kopi-glossary.md", file: "kopi-glossary.md" },
    ],
  },
  {
    id: "apac-pilot-pitch",
    title: "Pitching the APAC pilot",
    category: "Business Analyst",
    artifacts: [
      { id: "culture-map.md", file: "culture-map.md" },
      { id: "jordan-whitaker-profile.md", file: "jordan-whitaker-profile.md" },
    ],
  },
];

const packages = Object.fromEntries(
  definitions.map((definition) => {
    const caseRoot = resolve(frontendRoot, definition.id);
    const rubric = JSON.parse(
      readFileSync(resolve(caseRoot, "rubric.json"), "utf8"),
    );
    return [
      definition.id,
      {
        ...definition,
        version: rubric.caseVersion,
        rubricVersion: rubric.rubricVersion,
        released: true,
        evaluationMode: "human_final",
        rubric,
        caseInstructions: readFileSync(resolve(caseRoot, "case.md"), "utf8"),
        evaluationGuidance: readFileSync(
          resolve(caseRoot, "evaluation.md"),
          "utf8",
        ),
        coachingPrompt: readFileSync(
          resolve(caseRoot, "coaching.md"),
          "utf8",
        ),
        evaluationPrompt: readFileSync(
          resolve(caseRoot, "evaluation-prompt.md"),
          "utf8",
        ),
        artifacts: definition.artifacts.map((artifact) => ({
          id: artifact.id,
          version: rubric.caseVersion,
          content: readFileSync(resolve(caseRoot, artifact.file), "utf8"),
        })),
      },
    ];
  }),
);

mkdirSync(resolve(__dirname, "../generated"), { recursive: true });
writeFileSync(output, `${JSON.stringify(packages, null, 2)}\n`);
console.log(`Synced ${Object.keys(packages).length} case packages.`);
