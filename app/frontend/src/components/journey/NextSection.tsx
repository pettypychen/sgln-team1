import { ROADMAP_ITEMS } from "@/data/ideationJourney";
import { JourneyEyebrow } from "./JourneyEyebrow";
import { Icon } from "./icons";

/** Where the concept goes from here: the Aug 20 build session and the roadmap. */
export function NextSection() {
  return (
    <section
      id="next"
      className="bg-white px-5 pb-24 pt-20 scroll-mt-20 md:px-12 md:pt-28"
    >
      <div className="mx-auto max-w-container">
        <JourneyEyebrow>What&apos;s next</JourneyEyebrow>
        <h2 className="m-0 mb-12 font-display text-[30px] uppercase leading-[1.05] tracking-tight text-ink md:text-[46px]">
          From concept to working demo
        </h2>

        <div className="grid grid-cols-1 items-stretch gap-7 md:grid-cols-2">
          <div className="flex flex-col justify-center rounded-panel bg-manila p-10 warm-lift">
            <div className="mb-6 inline-flex items-center gap-2 self-start rounded-button bg-ink px-3.5 py-1.5 text-micro font-semibold uppercase tracking-[0.08em] text-white">
              <Icon name="calendar" size={16} />
              Aug 20 session
            </div>
            <h3 className="m-0 mb-4 font-display text-[30px] leading-[1.12] text-ink">
              Prototype the simulator
            </h3>
            <p className="m-0 text-body-lg leading-[1.55] text-muted-deep">
              Build a working demo with{" "}
              <strong className="font-semibold text-ink">
                2–3 real workflows
              </strong>{" "}
              — enough to walk a trainee through a full loop of doing,
              feedback, and a credential at the end.
            </p>
          </div>

          <div className="flex flex-col justify-center rounded-panel bg-white p-10 soft-edge">
            <div className="mb-6 inline-flex items-center gap-2 self-start rounded-button bg-cloud px-3.5 py-1.5 text-micro font-semibold uppercase tracking-[0.08em] text-muted-deep">
              <Icon name="map" size={16} />
              Roadmap
            </div>
            <h3 className="m-0 mb-6 font-display text-[30px] leading-[1.12] text-ink">
              Where it grows
            </h3>
            <div className="flex flex-col gap-5">
              {ROADMAP_ITEMS.map((item) => (
                <div key={item.title} className="flex items-start gap-4">
                  <Icon
                    name={item.icon}
                    size={26}
                    className="mt-0.5 flex-none text-teal"
                  />
                  <p className="m-0 text-body-lg leading-[1.5] text-muted-deep">
                    <strong className="font-semibold text-ink">
                      {item.title}
                    </strong>{" "}
                    — {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-20 flex flex-col gap-3 border-t border-hairline pt-8 text-small font-medium text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>Ideation Journey · From challenge to Workplace Flight Simulator</span>
          <a href="#challenge" className="text-teal transition-colors hover:text-ink">
            Back to top ↑
          </a>
        </div>
      </div>
    </section>
  );
}
