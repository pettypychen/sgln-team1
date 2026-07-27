import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CsvTable,
  parseCsv,
} from "../src/components/ui/CsvTable.tsx";
import {
  MarkdownDocument,
  stripMarkdownFrontmatter,
} from "../src/components/ui/MarkdownDocument.tsx";

const source = `---
slug: kopi-run
caseVersion: 1.0.0
---

# Kopi Run

1. Read the orders.
2. Check the **menu**.

| Colleague | Code |
| --- | --- |
| Aiman | K03 |
`;

const stripped = stripMarkdownFrontmatter(source);
assert.ok(!stripped.includes("slug: kopi-run"));

const markup = renderToStaticMarkup(<MarkdownDocument content={source} />);
assert.match(markup, /<h1[^>]*>Kopi Run<\/h1>/);
assert.match(markup, /<ol/);
assert.match(markup, /<strong>menu<\/strong>/);
assert.match(markup, /<table/);
assert.ok(!markup.includes("caseVersion"));

const csv = `Name,Preference,Price\r
Aiman,"No milk, no sugar",1.40\r
Beatrice,"Say ""kopi""",2.00\r
`;
assert.deepEqual(parseCsv(csv), [
  ["Name", "Preference", "Price"],
  ["Aiman", "No milk, no sugar", "1.40"],
  ["Beatrice", 'Say "kopi"', "2.00"],
]);

const csvMarkup = renderToStaticMarkup(<CsvTable content={csv} />);
assert.match(csvMarkup, /<table[^>]*aria-label="CSV data"/);
assert.match(csvMarkup, /<th[^>]*>Preference<\/th>/);
assert.match(csvMarkup, /<td[^>]*>No milk, no sugar<\/td>/);

console.log("source renderers: all checks passed");
