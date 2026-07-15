import { useEffect, useRef, useState } from "react";
import type { CasePdf } from "@/types";

interface CasePdfViewerProps {
  document: CasePdf;
  /** Persisted 1-based page position for this document. */
  page: number;
  zoom: number;
  onPageChange: (page: number) => void;
  onZoomChange: (zoom: number) => void;
}

type LoadState = "loading" | "ready" | "failed";

function clampZoom(value: number) {
  return Math.min(1.3, Math.max(0.82, Number(value.toFixed(2))));
}

function clampPage(value: number, pageCount: number) {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.min(pageCount, Math.max(1, Math.round(value)));
}

/** Case PDF review surface with loading, retry, paged navigation, and zoom controls. */
export function CasePdfViewer({
  document,
  page,
  zoom,
  onPageChange,
  onZoomChange,
}: CasePdfViewerProps) {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const viewportRef = useRef<HTMLDivElement>(null);

  const pageCount = document.pageCount;
  const currentPage = clampPage(page, pageCount);

  useEffect(() => {
    setLoadState("loading");
    const timer = window.setTimeout(() => {
      setLoadState(document.pages.length > 0 ? "ready" : "failed");
    }, 420);

    return () => window.clearTimeout(timer);
  }, [document.pages.length]);

  useEffect(() => {
    if (loadState === "ready" && viewportRef.current) {
      viewportRef.current.scrollTop = 0;
    }
  }, [loadState, currentPage]);

  function handleRetry() {
    setLoadState("loading");
    window.setTimeout(() => {
      setLoadState(document.pages.length > 0 ? "ready" : "failed");
    }, 420);
  }

  function goToPage(nextPage: number) {
    onPageChange(clampPage(nextPage, pageCount));
  }

  return (
    <section className="flex min-h-[680px] min-w-0 flex-col overflow-hidden rounded-panel bg-white soft-edge lg:h-full lg:min-h-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-4 py-3">
        <div className="min-w-0">
          <p className="m-0 text-micro font-medium text-muted">
            Source document
          </p>
          <h2 className="m-0 truncate text-label font-semibold text-ink">
            {document.title}
          </h2>
          <p className="m-0 mt-1 truncate font-mono text-micro text-muted">
            {document.fileName}
          </p>
        </div>
        <div className="flex flex-1 items-center justify-center gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="rounded-button bg-white px-3 py-1.5 text-small text-ink soft-edge transition-colors hover:bg-cloud disabled:cursor-not-allowed disabled:text-muted"
              onClick={() => goToPage(currentPage - 1)}
              disabled={loadState !== "ready" || currentPage <= 1}
              aria-label="Previous page"
            >
              ‹ Prev
            </button>
            <span className="rounded-button bg-cloud px-3 py-1.5 font-mono text-micro text-muted-deep">
              Page {currentPage}/{pageCount}
            </span>
            <button
              type="button"
              className="rounded-button bg-white px-3 py-1.5 text-small text-ink soft-edge transition-colors hover:bg-cloud disabled:cursor-not-allowed disabled:text-muted"
              onClick={() => goToPage(currentPage + 1)}
              disabled={loadState !== "ready" || currentPage >= pageCount}
              aria-label="Next page"
            >
              Next ›
            </button>
          </div>
          <button
            type="button"
            className="rounded-button bg-white px-3 py-1.5 text-small text-ink soft-edge transition-colors hover:bg-cloud"
            onClick={() => onZoomChange(clampZoom(zoom - 0.08))}
            aria-label="Zoom out"
          >
            −
          </button>
          <span className="min-w-12 text-center font-mono text-micro text-muted-deep">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            className="rounded-button bg-white px-3 py-1.5 text-small text-ink soft-edge transition-colors hover:bg-cloud"
            onClick={() => onZoomChange(clampZoom(zoom + 0.08))}
            aria-label="Zoom in"
          >
            +
          </button>
        </div>
      </div>

      {loadState === "loading" && (
        <div className="grid flex-1 place-items-center bg-cloud px-6 text-center">
          <div>
            <div className="mx-auto mb-4 h-10 w-10 rounded-button border border-hairline bg-white warm-lift" />
            <p className="m-0 text-label font-medium text-ink">
              Loading due diligence memo
            </p>
            <p className="m-0 mt-2 text-small text-muted-deep">
              Fetching the evidence packet for this simulation.
            </p>
          </div>
        </div>
      )}

      {loadState === "failed" && (
        <div className="grid flex-1 place-items-center bg-cloud px-6 text-center">
          <div className="max-w-[420px] rounded-panel bg-white p-5 soft-edge">
            <p className="m-0 text-label font-semibold text-ink">
              Case PDF could not be loaded
            </p>
            <p className="m-0 mt-2 text-small text-muted-deep">
              Keep the workspace open and retry the evidence packet. Progress is
              not changed automatically.
            </p>
            <button
              type="button"
              className="mt-4 rounded-button bg-black px-4 py-2 text-label font-medium text-white"
              onClick={handleRetry}
            >
              Retry PDF
            </button>
          </div>
        </div>
      )}

      {loadState === "ready" &&
        (() => {
          const activePage = document.pages[currentPage - 1];
          if (!activePage) {
            return null;
          }

          return (
            <div
              ref={viewportRef}
              className="flex-1 overflow-y-auto bg-[#f1f1ee] px-3 py-5 sm:px-6"
            >
              <div
                className="mx-auto flex max-w-[820px] flex-col gap-5 transition-transform"
                style={{ width: `${Math.round(100 * zoom)}%` }}
              >
                <article
                  key={activePage.heading}
                  className="min-h-[840px] rounded-[6px] bg-white px-8 py-10 text-ink shadow-[rgba(0,0,0,0.08)_0_0_0_1px,rgba(0,0,0,0.06)_0_14px_32px] sm:px-12"
                >
                  <div className="mb-10 flex items-start justify-between gap-6 border-b border-hairline pb-5">
                    <div>
                      <p className="m-0 text-micro font-medium text-muted">
                        {activePage.kicker}
                      </p>
                      <h3 className="m-0 mt-2 font-display text-[38px] font-light leading-[1.08]">
                        {activePage.heading}
                      </h3>
                    </div>
                    <span className="rounded-button bg-manila px-3 py-1.5 font-mono text-micro text-muted-deep warm-lift">
                      {String(currentPage).padStart(2, "0")}
                    </span>
                  </div>

                  <div className="space-y-5 text-body leading-relaxed text-muted-deep">
                    {activePage.body.map((paragraph) => (
                      <p key={paragraph} className="m-0">
                        {paragraph}
                      </p>
                    ))}
                  </div>

                  <div className="mt-10 rounded-panel bg-cloud p-4">
                    <p className="m-0 mb-3 text-micro font-medium text-muted">
                      Evidence references
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {activePage.evidence.map((item) => (
                        <span
                          key={item}
                          className="rounded-button bg-white px-3 py-1.5 text-small text-muted-deep soft-edge"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </article>

                <div className="flex items-center justify-between gap-3 pb-2">
                  <button
                    type="button"
                    className="rounded-button bg-white px-4 py-2 text-small font-medium text-ink soft-edge transition-colors hover:bg-cloud disabled:cursor-not-allowed disabled:text-muted"
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage <= 1}
                  >
                    ‹ Previous page
                  </button>
                  <span className="font-mono text-micro text-muted-deep">
                    Page {currentPage} of {pageCount}
                  </span>
                  <button
                    type="button"
                    className="rounded-button bg-white px-4 py-2 text-small font-medium text-ink soft-edge transition-colors hover:bg-cloud disabled:cursor-not-allowed disabled:text-muted"
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage >= pageCount}
                  >
                    Next page ›
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
    </section>
  );
}
