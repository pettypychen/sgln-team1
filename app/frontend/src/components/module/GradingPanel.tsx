import type { GradeReport, GradeVerdict } from "./workProductGrader";

interface GradingPanelProps {
  status: "loading" | "ready";
  report: GradeReport | null;
  onClose: () => void;
  onRerun: () => void;
  onOpenEvaluation: () => void;
}

const VERDICT_STYLES: Record<
  GradeVerdict,
  { chip: string; ring: string; label: string }
> = {
  distinction: {
    chip: "bg-teal text-white",
    ring: "text-teal",
    label: "Distinction",
  },
  pass: {
    chip: "bg-black text-white",
    ring: "text-ink",
    label: "Passing",
  },
  developing: {
    chip: "bg-amber/20 text-amber",
    ring: "text-amber",
    label: "Developing",
  },
};

function ScoreRing({ report }: { report: GradeReport }) {
  const pct = Math.round((report.total / report.max) * 100);
  const style = VERDICT_STYLES[report.verdict];
  const stops =
    report.verdict === "distinction"
      ? "#2f9e5f"
      : report.verdict === "pass"
        ? "#000000"
        : "#d98d5f";

  return (
    <div className="flex items-center gap-4">
      <div
        className="relative grid h-24 w-24 shrink-0 place-items-center rounded-full"
        style={{
          background: `conic-gradient(${stops} ${pct * 3.6}deg, rgba(0,0,0,0.06) 0deg)`,
        }}
      >
        <div className="grid h-[76px] w-[76px] place-items-center rounded-full bg-white">
          <span className="text-card font-light leading-none text-ink">
            {report.total}
          </span>
          <span className="mt-0.5 text-micro text-muted">/ {report.max}</span>
        </div>
      </div>
      <div className="min-w-0">
        <span
          className={
            "inline-flex rounded-button px-2.5 py-1 text-micro font-medium " +
            style.chip
          }
        >
          {style.label}
        </span>
        <p className="m-0 mt-2 text-small leading-snug text-muted-deep">
          {report.headline}
        </p>
      </div>
    </div>
  );
}

/** Slide-over report card for the mock AI grader. */
export function GradingPanel({
  status,
  report,
  onClose,
  onRerun,
  onOpenEvaluation,
}: GradingPanelProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/24" role="presentation">
      <button
        type="button"
        className="absolute inset-0 h-full w-full cursor-default"
        aria-label="Close AI grader"
        onClick={onClose}
      />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-[520px] flex-col bg-[#fbfaf7] shadow-[-24px_0_60px_rgba(0,0,0,0.18)]">
        <div className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-4">
          <div>
            <p className="m-0 text-micro font-medium text-muted">
              AI grader feedback
            </p>
            <h2 className="m-0 text-card font-light leading-tight text-ink">
              Report card
            </h2>
          </div>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-button bg-white text-label font-medium text-ink soft-edge"
            aria-label="Close AI grader"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {status === "loading" || !report ? (
          <div className="grid flex-1 place-items-center px-6 text-center">
            <div>
              <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-2 border-hairline border-t-black" />
              <p className="m-0 text-label font-medium text-ink">
                Grading your work product
              </p>
              <p className="m-0 mt-2 text-small text-muted-deep">
                Scoring against the six diligence competencies…
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
              <div className="rounded-panel bg-white p-4 soft-edge">
                <ScoreRing report={report} />
                <div className="mt-4">
                  <div className="relative h-2 w-full overflow-hidden rounded-button bg-cloud">
                    <div
                      className="h-full rounded-button bg-black transition-all"
                      style={{
                        width: `${Math.round((report.total / report.max) * 100)}%`,
                      }}
                    />
                    <span
                      className="absolute top-0 h-full w-px bg-muted"
                      style={{ left: `${report.passing}%` }}
                    />
                    <span
                      className="absolute top-0 h-full w-px bg-teal"
                      style={{ left: `${report.distinction}%` }}
                    />
                  </div>
                  <div className="mt-1.5 flex justify-between font-mono text-micro text-muted">
                    <span>Pass {report.passing}</span>
                    <span>Distinction {report.distinction}</span>
                  </div>
                </div>
              </div>

              <div>
                <p className="m-0 mb-2 text-micro font-medium uppercase text-muted">
                  Competency breakdown
                </p>
                <div className="space-y-2">
                  {report.competencies.map((competency) => {
                    const pct = Math.round(
                      (competency.earned / competency.max) * 100,
                    );
                    return (
                      <div
                        key={competency.id}
                        className="rounded-panel bg-white p-3 soft-edge"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-small font-medium text-ink">
                            {competency.label}
                          </span>
                          <span className="shrink-0 font-mono text-micro text-muted-deep">
                            {competency.earned}/{competency.max}
                          </span>
                        </div>
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-button bg-cloud">
                          <div
                            className={
                              "h-full rounded-button transition-all " +
                              (pct >= 80
                                ? "bg-teal"
                                : pct >= 50
                                  ? "bg-black"
                                  : "bg-amber")
                            }
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="m-0 mt-1.5 text-micro text-muted-deep">
                          {competency.note}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {report.gaps.length > 0 ? (
                <div className="rounded-panel border border-oxblood/25 bg-manila p-4">
                  <p className="m-0 mb-2 text-micro font-medium uppercase text-oxblood">
                    Missing or incomplete
                  </p>
                  <ul className="m-0 list-none space-y-1.5 p-0">
                    {report.gaps.map((gap) => (
                      <li
                        key={gap}
                        className="flex gap-2 text-small text-muted-deep"
                      >
                        <span className="text-oxblood" aria-hidden="true">
                          •
                        </span>
                        {gap}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="rounded-panel border border-teal/25 bg-white p-4">
                <p className="m-0 mb-2 text-micro font-medium uppercase text-teal">
                  Strengths
                </p>
                <ul className="m-0 list-none space-y-1.5 p-0">
                  {report.strengths.map((strength) => (
                    <li
                      key={strength}
                      className="flex gap-2 text-small text-muted-deep"
                    >
                      <span className="text-teal" aria-hidden="true">
                        ✓
                      </span>
                      {strength}
                    </li>
                  ))}
                </ul>
              </div>

              <p className="m-0 text-micro text-muted">
                This is an automated practice estimate based on the case rubric.
                The official evaluation may weigh judgment and nuance differently.
              </p>
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-hairline bg-[#fbfaf7] px-5 py-4">
              <button
                type="button"
                className="rounded-button bg-white px-4 py-2 text-small font-medium text-ink soft-edge transition-colors hover:bg-cloud"
                onClick={onRerun}
              >
                Re-run grading
              </button>
              <button
                type="button"
                className="rounded-button bg-black px-4 py-2 text-small font-medium text-white transition-colors hover:bg-graphite"
                onClick={onOpenEvaluation}
              >
                Open full evaluation
              </button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
