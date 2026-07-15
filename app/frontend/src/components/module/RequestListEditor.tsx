/**
 * Structured accordion editor for the diligence request list.
 *
 * The five fixed categories are collapsible sections; only the open category
 * shows its request rows, keeping the panel height constrained. The value is
 * serialized to the "## Category" + "- request" Markdown the evaluation rubric
 * and readiness checks expect.
 */

import { useState } from "react";

interface RequestListEditorProps {
  value: string;
  onChange: (value: string) => void;
}

const CATEGORIES = [
  "Corporate Authority",
  "Regulatory and Shareholder Approval",
  "Financial / Capital / Consideration",
  "Liabilities and Operations",
  "Closing Documents",
] as const;

type Category = (typeof CATEGORIES)[number];

type RequestMap = Record<Category, string[]>;

/** Keep a request on a single Markdown list line. */
function sanitizeItem(value: string) {
  return value.replace(/\s*\n\s*/g, " ").replace(/^[-*]\s*/, "");
}

function parseRequests(value: string): RequestMap {
  const map = {} as RequestMap;
  CATEGORIES.forEach((category) => {
    map[category] = [];
  });

  let current: Category | null = null;
  for (const rawLine of value.split("\n")) {
    const line = rawLine.trim();
    if (line.startsWith("## ")) {
      const heading = line.slice(3).trim();
      current = CATEGORIES.includes(heading as Category)
        ? (heading as Category)
        : null;
      continue;
    }

    if (current && /^[-*]/.test(line)) {
      map[current].push(line.replace(/^[-*]\s?/, ""));
    }
  }

  return map;
}

function serializeRequests(map: RequestMap): string {
  return (
    CATEGORIES.map((category) => {
      const lines = map[category].map((item) => `- ${sanitizeItem(item)}`);
      return [`## ${category}`, ...lines].join("\n");
    }).join("\n\n") + "\n"
  );
}

export function RequestListEditor({ value, onChange }: RequestListEditorProps) {
  const map = parseRequests(value);
  const [openCategory, setOpenCategory] = useState<Category | null>(
    CATEGORIES[0],
  );

  function commit(next: RequestMap) {
    onChange(serializeRequests(next));
  }

  function updateItem(category: Category, index: number, next: string) {
    const items = map[category].map((item, itemIndex) =>
      itemIndex === index ? next : item,
    );
    commit({ ...map, [category]: items });
  }

  function addItem(category: Category) {
    setOpenCategory(category);
    commit({ ...map, [category]: [...map[category], ""] });
  }

  function removeItem(category: Category, index: number) {
    commit({
      ...map,
      [category]: map[category].filter((_, itemIndex) => itemIndex !== index),
    });
  }

  const totalRequests = CATEGORIES.reduce(
    (sum, category) =>
      sum + map[category].filter((item) => item.trim().length > 0).length,
    0,
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-mono text-micro text-muted-deep">
          {totalRequests}/10 requests · grouped by category
        </span>
      </div>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
        {CATEGORIES.map((category) => {
          const open = openCategory === category;
          const filled = map[category].filter(
            (item) => item.trim().length > 0,
          ).length;

          return (
            <div
              key={category}
              className={
                "rounded-panel border bg-white transition-colors " +
                (open ? "border-black" : "border-hairline hover:border-border-hover")
              }
            >
              <button
                type="button"
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left"
                onClick={() => setOpenCategory(open ? null : category)}
                aria-expanded={open}
              >
                <span
                  className={
                    "h-2 w-2 shrink-0 rounded-button " +
                    (filled > 0 ? "bg-teal" : "bg-silver")
                  }
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate text-small font-medium text-ink">
                  {category}
                </span>
                <span className="shrink-0 rounded-button bg-manila px-2 py-0.5 font-mono text-micro text-muted-deep warm-lift">
                  {filled}
                </span>
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
                  <div className="space-y-2">
                    {map[category].length === 0 ? (
                      <p className="m-0 text-micro text-muted">
                        No requests yet in this category.
                      </p>
                    ) : (
                      map[category].map((item, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <input
                            type="text"
                            className="w-full rounded-button border border-hairline bg-[#fbfbfa] px-3 py-2 text-small text-ink outline-none transition-colors placeholder:text-muted focus:border-black focus:ring-2 focus:ring-black/10"
                            placeholder="Document or confirmation to request"
                            value={item}
                            onChange={(event) =>
                              updateItem(category, index, event.target.value)
                            }
                          />
                          <button
                            type="button"
                            className="shrink-0 rounded-button bg-cloud px-2 py-2 text-micro font-medium text-muted-deep transition-colors hover:bg-silver hover:text-ink"
                            onClick={() => removeItem(category, index)}
                            aria-label={`Remove request ${index + 1} from ${category}`}
                          >
                            Remove
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  <button
                    type="button"
                    className="mt-2 inline-flex min-h-9 items-center justify-center rounded-button bg-cloud px-3 py-1.5 text-small font-medium text-ink transition-colors hover:bg-silver"
                    onClick={() => addItem(category)}
                  >
                    + Add request
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
