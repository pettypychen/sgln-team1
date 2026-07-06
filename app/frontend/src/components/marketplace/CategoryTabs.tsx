import type { CategoryFilter } from "@/types";

interface CategoryTabsProps {
  categories: CategoryFilter[];
  active: CategoryFilter;
  onChange: (category: CategoryFilter) => void;
}

const CATEGORY_DETAIL: Record<
  CategoryFilter,
  { label: string; note: string; count: string; color: string }
> = {
  ALL: {
    label: "All",
    note: "Full marketplace",
    count: "09",
    color: "#000000",
  },
  LEGAL: {
    label: "Legal",
    note: "Redlines & intake",
    count: "03",
    color: "#256f67",
  },
  ACCOUNTING: {
    label: "Accounting",
    note: "Close & audit",
    count: "03",
    color: "#8b3a34",
  },
  "BUSINESS ANALYST": {
    label: "Business analyst",
    note: "Discovery & prioritization",
    count: "03",
    color: "#4f6f9d",
  },
};

/** Role/path selector for the simulation marketplace. */
export function CategoryTabs({ categories, active, onChange }: CategoryTabsProps) {
  return (
    <section className="mx-auto max-w-container px-5 md:px-12">
      <div className="flex flex-col gap-4 border-y border-hairline py-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-1 text-small text-muted">Explore pathways</div>
          <h2 className="m-0 font-display text-[36px] font-light leading-[1.1] text-ink">
            Choose a practice track.
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {categories.map((cat) => {
            const isActive = cat === active;
            const detail = CATEGORY_DETAIL[cat];
            return (
              <button
                key={cat}
                type="button"
                onClick={() => onChange(cat)}
                className={
                  "group min-h-[76px] cursor-pointer rounded-panel bg-white p-4 text-left transition-[background,box-shadow,transform] hover:-translate-y-0.5 " +
                  (isActive
                    ? "soft-edge"
                    : "shadow-[rgba(0,0,0,0.04)_0_0_0_1px] hover:bg-cloud")
                }
              >
                <span className="mb-3 flex items-center justify-between gap-3">
                  <span
                    className="h-2 w-7 rounded-button transition-[width] group-hover:w-9"
                    style={{ background: detail.color }}
                    aria-hidden="true"
                  />
                  <span className="font-mono text-micro text-muted">
                    {detail.count}
                  </span>
                </span>
                <span className="block text-[15px] font-semibold text-ink">
                  {detail.label}
                </span>
                <span className="mt-1 block text-small text-muted-deep">
                  {detail.note}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
