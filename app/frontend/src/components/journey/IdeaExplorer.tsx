import { useState } from "react";
import { JOURNEY_THEMES } from "@/data/ideationJourney";
import type { JourneyIdea, JourneyTheme } from "@/data/ideationJourney";
import { JourneyEyebrow } from "./JourneyEyebrow";
import { Icon } from "./icons";

interface ActiveIdea {
  idea: JourneyIdea;
  theme: JourneyTheme;
}

const FIRST: ActiveIdea = {
  idea: JOURNEY_THEMES[0].ideas[0],
  theme: JOURNEY_THEMES[0],
};

/**
 * The divergence exercise: every raw idea as a chip, grouped by theme, with a
 * sticky detail panel that follows hover/focus (the reference page's only
 * interactive element).
 */
export function IdeaExplorer() {
  const [active, setActive] = useState<ActiveIdea>(FIRST);

  return (
    <section
      id="ideas"
      className="bg-paper px-5 py-20 scroll-mt-20 md:px-12 md:py-28"
    >
      <div className="mx-auto max-w-container">
        <JourneyEyebrow>Diverge</JourneyEyebrow>
        <h2 className="m-0 mb-3.5 font-display text-[36px] font-light leading-[1.05] text-ink md:text-[54px]">
          27 ideas, five ways to answer it
        </h2>
        <p className="m-0 mb-12 max-w-[640px] text-body-lg text-muted-deep">
          We went wide before we went deep. Hover or tap any idea to see what
          it means.
        </p>

        <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[1fr_360px] lg:gap-[52px]">
          <div className="flex flex-col gap-8">
            {JOURNEY_THEMES.map((theme) => (
              <div key={theme.name}>
                <div className="mb-4 flex items-center gap-2.5">
                  <span
                    className="h-2.5 w-2.5 rounded-[3px]"
                    style={{ background: theme.color }}
                    aria-hidden="true"
                  />
                  <h3 className="m-0 text-small font-semibold uppercase tracking-[0.08em] text-ink">
                    {theme.name}
                  </h3>
                </div>
                <div className="flex flex-wrap gap-3">
                  {theme.ideas.map((idea) => {
                    const isActive = active.idea.name === idea.name;
                    return (
                      <button
                        key={idea.name}
                        type="button"
                        onMouseEnter={() => setActive({ idea, theme })}
                        onFocus={() => setActive({ idea, theme })}
                        onClick={() => setActive({ idea, theme })}
                        className={
                          "cursor-pointer rounded-sharp bg-white px-[18px] py-3 text-left text-label font-medium transition-all duration-150 " +
                          (isActive
                            ? "-translate-y-0.5 text-ink"
                            : "text-muted-deep soft-edge hover:text-ink")
                        }
                        style={
                          isActive
                            ? {
                                boxShadow: `0 0 0 1.5px ${theme.color}, rgba(0,0,0,0.08) 0 6px 16px`,
                              }
                            : undefined
                        }
                      >
                        {idea.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="lg:sticky lg:top-24">
            <div className="min-h-[300px] rounded-panel bg-white p-8 warm-lift">
              <div className="mb-5 flex items-center gap-2.5">
                <span
                  className="h-3 w-3 rounded-[4px] transition-colors"
                  style={{ background: active.theme.color }}
                  aria-hidden="true"
                />
                <span
                  className="text-micro font-semibold uppercase tracking-[0.1em] transition-colors"
                  style={{ color: active.theme.color }}
                >
                  {active.theme.name}
                </span>
              </div>
              <h3 className="m-0 mb-4 font-display text-[30px] font-light leading-[1.15] text-ink">
                {active.idea.name}
              </h3>
              <p className="m-0 text-body-lg text-muted-deep">
                {active.idea.description}
              </p>
              <div className="mt-7 flex items-center gap-2 border-t border-hairline pt-5 text-small font-medium text-muted">
                <Icon name="cursor-pointer" size={18} />
                <span>Hover any idea to explore</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
