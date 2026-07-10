import {
  CONVERGE_INSIGHT,
  CONVERGE_STEPS,
  FUNNEL_STAGES,
} from "@/data/ideationJourney";
import { JourneyEyebrow } from "./JourneyEyebrow";
import { Icon } from "./icons";

/** How the 27 ideas were narrowed: two passes on the left, funnel on the right. */
export function ConvergeSection() {
  return (
    <section
      id="narrow"
      className="bg-white px-5 py-20 scroll-mt-20 md:px-12 md:py-28"
    >
      <div className="mx-auto max-w-container">
        <JourneyEyebrow>Converge</JourneyEyebrow>
        <h2 className="m-0 mb-14 font-display text-[36px] font-light leading-[1.05] text-ink md:text-[54px]">
          Then we narrowed, twice over
        </h2>

        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-[72px]">
          <div className="flex flex-col gap-6">
            {CONVERGE_STEPS.map((step, i) => (
              <div key={step.title} className="flex items-start gap-5">
                <div className="flex h-12 w-12 flex-none items-center justify-center rounded-button bg-ink font-display text-[22px] font-light text-white">
                  {i + 1}
                </div>
                <div>
                  <h3 className="m-0 mb-2 text-[22px] font-semibold leading-[1.2] text-ink">
                    {step.title}
                  </h3>
                  <p className="m-0 text-body-lg text-muted-deep">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
            <div className="flex items-start gap-4 rounded-panel bg-manila p-7 warm-lift">
              <Icon name="flash" size={28} className="flex-none text-teal" />
              <p className="m-0 text-body-lg leading-[1.55] text-ink">
                <strong className="font-semibold">
                  The ideas converged on one insight:
                </strong>{" "}
                {CONVERGE_INSIGHT}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-center gap-3">
            {FUNNEL_STAGES.map((stage, i) => {
              const isLast = i === FUNNEL_STAGES.length - 1;
              return (
                <div
                  key={stage.label}
                  className="contents"
                >
                  <div
                    className={
                      "flex h-[88px] items-center justify-center gap-4 rounded-panel " +
                      (isLast
                        ? "bg-ink text-white shadow-[rgba(0,0,0,0.18)_0_6px_16px]"
                        : i === 0
                          ? "bg-cloud text-muted-deep soft-edge"
                          : i === 1
                            ? "bg-silver text-ink"
                            : "bg-manila text-ink warm-lift")
                    }
                    style={{ width: `${stage.width * 100}%`, maxWidth: 560 }}
                  >
                    <span className="font-display text-[34px] font-light">
                      {stage.count}
                    </span>
                    <span className="text-[19px] font-medium">
                      {stage.label}
                    </span>
                  </div>
                  {!isLast && (
                    <Icon
                      name="nav-arrow-down"
                      size={26}
                      className="text-muted"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
