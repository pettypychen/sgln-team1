/**
 * Structured accordion editor for the diligence issue log.
 *
 * Each issue is a collapsed row showing a status dot and a one-line preview;
 * clicking expands only that issue's labeled fields, keeping the list height
 * constrained instead of rendering every field of every issue at once. The
 * value is serialized back to the exact Markdown table the evaluation rubric
 * and readiness checks expect, so nothing downstream needs to change.
 */

import { useState } from "react";

interface IssueLogEditorProps {
  value: string;
  onChange: (value: string) => void;
}

interface IssueRow {
  section: string;
  issue: string;
  why: string;
  risk: string;
  next: string;
}

const COLUMNS: {
  key: keyof IssueRow;
  label: string;
  placeholder: string;
  multiline: boolean;
  span: boolean;
}[] = [
  { key: "section", label: "Section", placeholder: "e.g. Preamble", multiline: false, span: false },
  { key: "risk", label: "Risk", placeholder: "High / Medium / Low", multiline: false, span: false },
  { key: "issue", label: "Issue", placeholder: "What is the problem?", multiline: true, span: true },
  { key: "why", label: "Why it matters", placeholder: "Deal impact", multiline: true, span: false },
  { key: "next", label: "Next step", placeholder: "Document, confirmation, or specialist", multiline: true, span: false },
];

const HEADER = "| Section | Issue | Why It Matters | Risk | Next Step |";
const SEPARATOR = "| --- | --- | --- | --- | --- |";

/** Keep user text valid inside a single Markdown table cell. */
function sanitizeCell(value: string) {
  return value.replace(/\|/g, "/").replace(/\s*\n\s*/g, " ").trim();
}

function parseRows(value: string): IssueRow[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.startsWith("|") &&
        !line.includes("---") &&
        !line.toLowerCase().includes("section | issue"),
    )
    .map((line) => {
      // A row like "| a | b |" splits to ["", " a ", " b ", ""].
      const cells = line.split("|").map((cell) => cell.trim());
      return {
        section: cells[1] ?? "",
        issue: cells[2] ?? "",
        why: cells[3] ?? "",
        risk: cells[4] ?? "",
        next: cells[5] ?? "",
      };
    });
}

function serializeRows(rows: IssueRow[]): string {
  const body = rows.map(
    (row) =>
      `| ${sanitizeCell(row.section)} | ${sanitizeCell(row.issue)} | ${sanitizeCell(
        row.why,
      )} | ${sanitizeCell(row.risk)} | ${sanitizeCell(row.next)} |`,
  );

  return [HEADER, SEPARATOR, ...body].join("\n") + "\n";
}

const EMPTY_ROW: IssueRow = {
  section: "",
  issue: "",
  why: "",
  risk: "",
  next: "",
};

function isComplete(row: IssueRow) {
  return (
    row.section.trim().length > 0 &&
    row.issue.trim().length > 0 &&
    row.risk.trim().length > 0
  );
}

function riskTone(risk: string) {
  const normalized = risk.trim().toLowerCase();
  if (normalized === "high") {
    return "bg-oxblood/10 text-oxblood";
  }
  if (normalized === "medium") {
    return "bg-amber/15 text-amber";
  }
  if (normalized === "low") {
    return "bg-teal/10 text-teal";
  }
  return "bg-cloud text-muted";
}

export function IssueLogEditor({ value, onChange }: IssueLogEditorProps) {
  const rows = parseRows(value);
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  function updateRow(index: number, key: keyof IssueRow, next: string) {
    const nextRows = rows.map((row, rowIndex) =>
      rowIndex === index ? { ...row, [key]: next } : row,
    );
    onChange(serializeRows(nextRows));
  }

  function addRow() {
    onChange(serializeRows([...rows, { ...EMPTY_ROW }]));
    setOpenIndex(rows.length);
  }

  function removeRow(index: number) {
    onChange(serializeRows(rows.filter((_, rowIndex) => rowIndex !== index)));
    setOpenIndex((current) =>
      current === null ? null : current === index ? null : current > index ? current - 1 : current,
    );
  }

  const completeCount = rows.filter(isComplete).length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-mono text-micro text-muted-deep">
          {completeCount}/{Math.max(rows.length, 12)} complete · aim for 12
        </span>
      </div>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
        {rows.length === 0 ? (
          <p className="m-0 rounded-panel border border-dashed border-hairline bg-white px-4 py-6 text-center text-small text-muted-deep">
            No issues yet. Add your first diligence issue to begin.
          </p>
        ) : (
          rows.map((row, index) => {
            const open = openIndex === index;
            const complete = isComplete(row);

            return (
              <div
                key={index}
                className={
                  "rounded-panel border bg-white transition-colors " +
                  (open ? "border-black" : "border-hairline hover:border-border-hover")
                }
              >
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left"
                  onClick={() => setOpenIndex(open ? null : index)}
                  aria-expanded={open}
                >
                  <span
                    className={
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-button text-micro font-medium " +
                      (complete
                        ? "bg-teal text-white"
                        : "border border-hairline bg-cloud text-muted")
                    }
                    aria-hidden="true"
                  >
                    {complete ? "✓" : index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-small text-ink">
                    {row.issue.trim() ? (
                      <>
                        <span className="font-medium">{row.section.trim() || "Issue"}</span>
                        <span className="text-muted-deep"> — {row.issue.trim()}</span>
                      </>
                    ) : (
                      <span className="text-muted">Issue {index + 1} — untitled</span>
                    )}
                  </span>
                  {row.risk.trim() ? (
                    <span
                      className={
                        "shrink-0 rounded-button px-2 py-0.5 text-micro font-medium capitalize " +
                        riskTone(row.risk)
                      }
                    >
                      {row.risk.trim()}
                    </span>
                  ) : null}
                  <span
                    className={
                      "shrink-0 text-muted transition-transform " + (open ? "rotate-180" : "")
                    }
                    aria-hidden="true"
                  >
                    ⌄
                  </span>
                </button>

                {open ? (
                  <div className="border-t border-hairline px-3 py-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      {COLUMNS.map((column) => (
                        <label
                          key={column.key}
                          className={"block " + (column.span ? "sm:col-span-2" : "")}
                        >
                          <span className="mb-1 block text-micro font-medium uppercase text-muted">
                            {column.label}
                          </span>
                          {column.multiline ? (
                            <textarea
                              className="min-h-14 w-full resize-y rounded-button border border-hairline bg-[#fbfbfa] px-3 py-2 text-small text-ink outline-none transition-colors placeholder:text-muted focus:border-black focus:ring-2 focus:ring-black/10"
                              placeholder={column.placeholder}
                              value={row[column.key]}
                              onChange={(event) =>
                                updateRow(index, column.key, event.target.value)
                              }
                            />
                          ) : (
                            <input
                              type="text"
                              className="w-full rounded-button border border-hairline bg-[#fbfbfa] px-3 py-2 text-small text-ink outline-none transition-colors placeholder:text-muted focus:border-black focus:ring-2 focus:ring-black/10"
                              placeholder={column.placeholder}
                              value={row[column.key]}
                              onChange={(event) =>
                                updateRow(index, column.key, event.target.value)
                              }
                            />
                          )}
                        </label>
                      ))}
                    </div>
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        className="rounded-button bg-cloud px-2.5 py-1 text-micro font-medium text-muted-deep transition-colors hover:bg-silver hover:text-ink"
                        onClick={() => removeRow(index)}
                        aria-label={`Remove issue ${index + 1}`}
                      >
                        Remove issue
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      <button
        type="button"
        className="mt-2 inline-flex min-h-9 w-full items-center justify-center rounded-button bg-white px-4 py-2 text-small font-medium text-ink soft-edge transition-colors hover:bg-cloud"
        onClick={addRow}
      >
        + Add issue
      </button>
    </div>
  );
}
