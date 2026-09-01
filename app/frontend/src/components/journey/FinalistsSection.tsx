import { FINALISTS } from "@/data/ideationJourney";
import { JourneyEyebrow } from "./JourneyEyebrow";
import { Icon } from "./icons";

/** The three shortlisted ideas, with the winner called out on a dark card. */
export function FinalistsSection() {
  return (
    <section
      id="finalists"
      className="bg-paper px-5 py-20 scroll-mt-20 md:px-12 md:py-28"
    >
      <div className="mx-auto max-w-container">
        <JourneyEyebrow>The shortlist</JourneyEyebrow>
        <h2 className="m-0 mb-12 font-display text-[30px] uppercase leading-[1.05] tracking-tight text-ink md:text-[46px]">
          Three front-runners, one winner
        </h2>

        <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-3 lg:grid-cols-[1fr_1fr_1.12fr]">
          {FINALISTS.map((finalist) =>
            finalist.winner ? (
              <div
                key={finalist.name}
                className="flex flex-col rounded-panel bg-surface-dark p-8 text-white shadow-[rgba(0,0,0,0.22)_0_14px_32px]"
              >
                <div className="mb-5">
                  <span className="inline-flex items-center gap-1.5 rounded-button bg-white px-3 py-1.5 text-micro font-semibold uppercase tracking-[0.08em] text-ink">
                    <Icon name="trophy" size={15} />
                    Winner
                  </span>
                </div>
                <h3 className="m-0 mb-5 font-display text-[30px] leading-[1.12] text-white">
                  {finalist.name}
                </h3>
                <div className="flex flex-col gap-3">
                  {finalist.strengths?.map((strength) => (
                    <div key={strength} className="flex items-start gap-3">
                      <Icon
                        name="check-circle"
                        size={22}
                        className="mt-px flex-none text-amber"
                      />
                      <span className="text-body leading-[1.4] text-white/85">
                        {strength}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div
                key={finalist.name}
                className="flex flex-col rounded-panel bg-white p-8 soft-edge"
              >
                <div className="mb-5 text-micro font-semibold uppercase tracking-[0.1em] text-muted">
                  Finalist
                </div>
                <h3 className="m-0 mb-4 font-display text-[26px] leading-[1.15] text-ink">
                  {finalist.name}
                </h3>
                <p className="m-0 text-body-lg text-muted-deep">
                  {finalist.description}
                </p>
              </div>
            ),
          )}
        </div>
      </div>
    </section>
  );
}
