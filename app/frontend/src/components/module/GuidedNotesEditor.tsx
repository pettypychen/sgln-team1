import { useMemo, useState } from "react";
import type { WorkProductDraft } from "@/types";
import { composeGuidedDoc, parseGuidedDoc } from "./guidedNotes";
import { buildWorkProductReadiness } from "./workProductReadiness";

interface GuidedNotesEditorProps {
  draft: WorkProductDraft;
  onDraftChange: (draft: WorkProductDraft) => void;
}

const PLACEHOLDER = `Analyze the PDF on the left. Document your findings here.

Keep the three headers below. Under the issue log, add one table row per material issue (Section, Issue, Why It Matters, Risk, Next Step). Under the request list, add "- " bullets grouped by heading. Then write a summary under 350 words.

When done, click "Submit for AI grading" below.`;

/**
 * Distraction-free Markdown editor covering all three deliverables as one
 * document. Local raw text is the editing source of truth; every change is
 * parsed back into the structured draft so readiness and grading stay live.
 */
export function GuidedNotesEditor({ draft, onDraftChange }: GuidedNotesEditorProps) {
  const [text, setText] = useState(() => composeGuidedDoc(draft));

  const readiness = useMemo(
    () => buildWorkProductReadiness(parseGuidedDoc(text)),
    [text],
  );

  function handleChange(next: string) {
    setText(next);
    onDraftChange(parseGuidedDoc(next));
  }

  const stats = [
    {
      label: "Issues",
      value: `${readiness.issueLog.count}/12`,
      ready: readiness.issueLog.ready,
      count: readiness.issueLog.count,
    },
    {
      label: "Requests",
      value: `${readiness.requestList.count}/10`,
      ready: readiness.requestList.ready,
      count: readiness.requestList.count,
    },
    {
      label: "Summary",
      value: `${readiness.associateSummary.count}w`,
      ready: readiness.associateSummary.ready,
      count: readiness.associateSummary.count,
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-button bg-manila px-2.5 py-1 font-mono text-micro text-muted-deep warm-lift">
          Markdown · one combined document
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          {stats.map((stat) => (
            <span
              key={stat.label}
              className="inline-flex items-center gap-1.5 rounded-button bg-white px-2.5 py-1 text-micro text-muted-deep soft-edge"
            >
              <span
                className={
                  "h-1.5 w-1.5 shrink-0 rounded-button " +
                  (stat.ready
                    ? "bg-teal"
                    : stat.count > 0
                      ? "bg-amber"
                      : "bg-silver")
                }
                aria-hidden="true"
              />
              {stat.label} {stat.value}
            </span>
          ))}
        </div>
      </div>

      <textarea
        className="min-h-0 w-full flex-1 resize-none rounded-panel border border-hairline bg-white px-4 py-4 font-mono text-small leading-[1.7] text-ink outline-none transition-colors placeholder:text-muted focus:border-black focus:ring-2 focus:ring-black/10"
        value={text}
        onChange={(event) => handleChange(event.target.value)}
        placeholder={PLACEHOLDER}
        spellCheck
        aria-label="Guided notes work product editor"
      />
    </div>
  );
}
