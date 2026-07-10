import { Link } from "react-router-dom";
import { Logo } from "@/components/layout/Logo";
import { JOURNEY_SECTIONS } from "@/data/ideationJourney";

/**
 * Sticky in-page nav for the journey story: SimWorks wordmark home link on
 * the left, section anchors on the right (mirrors the reference page's nav).
 */
export function JourneyNav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-hairline bg-white/90 px-5 py-3 backdrop-blur-xl md:px-12">
      <div className="mx-auto flex max-w-container items-center justify-between gap-5">
        <Link to="/" className="flex items-center gap-3 text-ink">
          <Logo className="h-[22px] w-auto" />
          <div>
            <span className="block text-[15px] font-semibold tracking-wordmark text-ink">
              IDEATION JOURNEY
            </span>
            <span className="hidden text-micro text-muted sm:block">
              How SimWorks came to be
            </span>
          </div>
        </Link>

        <div className="hidden items-center gap-1 text-[15px] font-medium md:flex">
          {JOURNEY_SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="cursor-pointer rounded-button px-3 py-2 text-muted-deep transition-colors hover:bg-cloud hover:text-ink"
            >
              {section.label}
            </a>
          ))}
        </div>
      </div>
    </nav>
  );
}
