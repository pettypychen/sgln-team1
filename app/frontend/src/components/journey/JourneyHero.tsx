import { Icon } from "./icons";

/** Full-height opening section stating the challenge. */
export function JourneyHero() {
  return (
    <section
      id="challenge"
      className="relative flex min-h-[calc(100vh-62px)] items-center overflow-hidden bg-surface-dark px-5 py-20 text-white scroll-mt-20 md:px-12 md:py-24"
    >
      <div
        className="pointer-events-none absolute -right-40 -top-32 h-[620px] w-[620px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(185,131,59,0.14) 0%, rgba(185,131,59,0) 70%)",
        }}
        aria-hidden="true"
      />
      <div className="case-enter relative mx-auto w-full max-w-container">
        <div className="mb-7 text-small font-medium uppercase tracking-[0.16em] text-amber">
          The challenge · How might we
        </div>
        <h1 className="m-0 max-w-[1080px] font-display text-[36px] uppercase leading-[1.08] tracking-tight text-white [text-wrap:balance] md:text-[56px] lg:text-[66px]">
          Help non-tech graduates in Singapore grow into{" "}
          <span className="text-amber">capable professionals</span> — when the
          early-career training ground is being{" "}
          <span className="text-amber">eroded by AI</span>.
        </h1>
        <div className="mt-11 flex max-w-[760px] items-start gap-[18px] border-t border-white/15 pt-7">
          <Icon
            name="warning-triangle"
            size={28}
            className="mt-0.5 flex-none text-amber"
          />
          <p className="m-0 text-body-lg leading-[1.6] text-white/70">
            AI is automating the grunt work that used to build judgment. The
            apprenticeship of doing — the training ground where early careers
            are made — is quietly disappearing.
          </p>
        </div>
        <div className="mt-16 flex items-center gap-3 text-small font-medium uppercase tracking-[0.1em] text-white/50">
          <span>Follow the journey</span>
          <Icon name="arrow-down" size={22} className="journey-bob" />
        </div>
      </div>
    </section>
  );
}
