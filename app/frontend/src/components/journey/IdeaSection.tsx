import {
  IDEA_INTRO,
  IDEA_PILLARS,
  SWDA_FLOW,
} from "@/data/ideationJourney";
import { Icon } from "./icons";

/** The winning concept in depth: the two pillars plus the SWDA credential flow. */
export function IdeaSection() {
  return (
    <section
      id="idea"
      className="relative overflow-hidden bg-surface-dark px-5 py-20 text-white scroll-mt-20 md:px-12 md:py-28"
    >
      <div
        className="pointer-events-none absolute -bottom-36 -left-36 h-[520px] w-[520px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(185,131,59,0.12) 0%, rgba(185,131,59,0) 70%)",
        }}
        aria-hidden="true"
      />
      <div className="relative mx-auto max-w-container">
        <div className="mb-3.5 flex items-center gap-3">
          <Icon name="airplane" size={26} className="text-amber" />
          <span className="text-small font-medium uppercase tracking-[0.16em] text-amber">
            The idea
          </span>
        </div>
        <h2 className="m-0 mb-4 font-display text-[38px] font-light leading-[1.05] text-white md:text-[60px]">
          Workplace Flight Simulator
        </h2>
        <p className="m-0 mb-12 max-w-[820px] text-[20px] leading-[1.55] text-white/70">
          {IDEA_INTRO}
        </p>

        <div className="grid grid-cols-1 items-stretch gap-7 md:grid-cols-2">
          {IDEA_PILLARS.map((pillar) => (
            <div
              key={pillar.title}
              className="flex flex-col rounded-panel border border-white/15 bg-white/5 p-9"
            >
              <div className="mb-5 flex items-center gap-3.5">
                <Icon name={pillar.icon} size={28} className="text-amber" />
                <h3 className="m-0 text-[24px] font-semibold text-white">
                  {pillar.title}
                </h3>
              </div>
              <p className="m-0 mb-5 text-body-lg leading-[1.6] text-white/75">
                <strong className="font-semibold text-white">
                  {pillar.bold}
                </strong>{" "}
                {pillar.description}
              </p>
              <div className="mt-auto flex flex-wrap gap-2.5">
                {pillar.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-button border border-white/25 bg-white/10 px-3.5 py-1.5 text-label font-medium text-white/85"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-7 rounded-panel border border-white/15 bg-white/5 p-9">
          <div className="mb-2.5 flex items-center gap-3.5">
            <Icon name="network-left" size={26} className="text-amber" />
            <h3 className="m-0 text-[22px] font-semibold text-white">
              From simulation to job offer
            </h3>
          </div>
          <p className="m-0 mb-9 max-w-[900px] text-body-lg leading-[1.6] text-white/75">
            We&apos;re working with the{" "}
            <strong className="font-semibold text-white">
              Skills and Workforce Development Agency (SWDA)
            </strong>{" "}
            so completed simulations flow straight into the workforce system
            trainees already use.
          </p>
          <div className="grid grid-cols-1 items-stretch gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0">
            {SWDA_FLOW.map((flowStep, i) => (
              <div key={flowStep.step} className="flex items-center">
                <div className="flex-1">
                  <div className="mb-3 text-micro font-semibold uppercase tracking-[0.1em] text-amber">
                    {flowStep.step}
                  </div>
                  <h4 className="m-0 mb-2 text-[18px] font-semibold text-white">
                    {flowStep.title}
                  </h4>
                  <p className="m-0 text-[15px] leading-[1.5] text-white/65">
                    {flowStep.description}
                  </p>
                </div>
                {i < SWDA_FLOW.length - 1 && (
                  <Icon
                    name="arrow-right"
                    size={24}
                    className="mx-4 hidden flex-none text-white/30 lg:block"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
