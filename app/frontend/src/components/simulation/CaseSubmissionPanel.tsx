import type { ReactNode } from "react";

export interface SubmissionReadinessItem {
  label: string;
  ready: boolean;
  detail?: string;
}

interface CaseSubmissionPanelProps {
  title?: string;
  eyebrow?: string;
  description?: string;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  textareaId?: string;
  readinessItems?: SubmissionReadinessItem[];
  children?: ReactNode;
  className?: string;
  editorClassName?: string;
}

function readinessDotClass(ready: boolean) {
  return ready ? "bg-teal" : "bg-silver";
}

/**
 * Shared learner submission surface. The AI chat can help, but this card makes
 * the evaluated work explicit and consistent across case workspaces and review.
 */
export function CaseSubmissionPanel({
  title = "Your submission",
  eyebrow = "Submission draft",
  description,
  value,
  onChange,
  placeholder,
  textareaId = "case-submission",
  readinessItems,
  children,
  className = "",
  editorClassName = "min-h-72",
}: CaseSubmissionPanelProps) {
  const readyCount = readinessItems?.filter((item) => item.ready).length ?? 0;

  return (
    <section className={`rounded-panel bg-white p-5 soft-edge ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="m-0 text-micro font-semibold uppercase tracking-[.16em] text-muted">
            {eyebrow}
          </p>
          <h2 className="m-0 mt-1 text-label font-semibold text-ink">
            {title}
          </h2>
          {description ? (
            <p className="m-0 mt-1 text-small text-muted-deep">
              {description}
            </p>
          ) : null}
        </div>
        {readinessItems && readinessItems.length > 0 ? (
          <span
            className={
              "rounded-button px-2.5 py-1 text-micro font-medium " +
              (readyCount === readinessItems.length
                ? "bg-teal text-white"
                : "bg-manila text-muted-deep warm-lift")
            }
          >
            {readyCount}/{readinessItems.length} ready
          </span>
        ) : null}
      </div>

      {readinessItems && readinessItems.length > 0 ? (
        <ul className="mt-4 grid gap-2 p-0">
          {readinessItems.map((item) => (
            <li
              key={item.label}
              className="flex list-none items-start gap-2 text-small text-muted-deep"
            >
              <span
                aria-hidden="true"
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${readinessDotClass(item.ready)}`}
              />
              <span>
                <span className="text-ink">{item.label}</span>
                {item.detail ? (
                  <span className="text-muted"> · {item.detail}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 flex min-h-0 flex-1 flex-col">
        {children ?? (
          <>
            <label className="sr-only" htmlFor={textareaId}>
              {title}
            </label>
            <textarea
              id={textareaId}
              required
              value={value ?? ""}
              onChange={(event) => onChange?.(event.target.value)}
              className={`${editorClassName} w-full resize-none rounded-panel border border-hairline px-4 py-4 font-mono text-small leading-relaxed text-ink outline-none transition-colors placeholder:text-muted focus:border-black focus:ring-2 focus:ring-black/10`}
              placeholder={placeholder}
              spellCheck
            />
          </>
        )}
      </div>
    </section>
  );
}
