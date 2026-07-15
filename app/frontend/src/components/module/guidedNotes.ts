/**
 * Guided Notes <-> WorkProductDraft bridge.
 *
 * "Guided Notes" mode edits all three deliverables as a single Markdown
 * document using the exact top-level headers the evaluation rubric expects
 * (`# Diligence Issue Log`, `# Diligence Request List`, `# Associate
 * Summary`). Composing and parsing keeps the underlying structured draft in
 * sync, so readiness checks and grading are identical across both modes.
 */

import type { WorkProductDraft } from "@/types";

export const ISSUE_HEADER = "# Diligence Issue Log";
export const REQUEST_HEADER = "# Diligence Request List";
export const SUMMARY_HEADER = "# Associate Summary";

const MARKERS: { key: keyof WorkProductDraft; header: string }[] = [
  { key: "issueLog", header: ISSUE_HEADER },
  { key: "requestList", header: REQUEST_HEADER },
  { key: "associateSummary", header: SUMMARY_HEADER },
];

/** Serialize the structured draft into one Markdown document. */
export function composeGuidedDoc(draft: WorkProductDraft): string {
  return [
    ISSUE_HEADER,
    "",
    draft.issueLog.trim(),
    "",
    REQUEST_HEADER,
    "",
    draft.requestList.trim(),
    "",
    SUMMARY_HEADER,
    "",
    draft.associateSummary.trim(),
    "",
  ].join("\n");
}

/**
 * Split a combined Markdown document back into the three deliverables.
 *
 * Tolerant of missing sections and reordering: each section is the text
 * between its header and the next recognized header (or end of document).
 */
export function parseGuidedDoc(text: string): WorkProductDraft {
  const lines = text.split("\n");

  const positions = MARKERS.map((marker) => ({
    key: marker.key,
    index: lines.findIndex((line) => line.trim() === marker.header),
  }))
    .filter((marker) => marker.index !== -1)
    .sort((a, b) => a.index - b.index);

  const draft: WorkProductDraft = {
    issueLog: "",
    requestList: "",
    associateSummary: "",
  };

  positions.forEach((marker, order) => {
    const start = marker.index + 1;
    const end =
      order + 1 < positions.length ? positions[order + 1].index : lines.length;
    draft[marker.key] = lines.slice(start, end).join("\n").trim();
  });

  return draft;
}
