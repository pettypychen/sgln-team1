import { Link } from "react-router-dom";
import { Logo } from "./Logo";

interface NavLink {
  label: string;
  active?: boolean;
  /** Router path for links that navigate (the rest are static placeholders). */
  to?: string;
}

const NAV_LINKS: NavLink[] = [
  { label: "Marketplace", active: true },
  { label: "Practice" },
  { label: "Credentials" },
  { label: "Enterprise" },
  { label: "Journey", to: "/journey" },
];

/** User initials shown in the avatar (static in the reference). */
const AVATAR_INITIALS = "MC";

/** Compact product header for the simulation marketplace. */
export function Navbar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-hairline bg-white/90 px-5 py-3 backdrop-blur-xl md:px-12">
      <div className="mx-auto flex max-w-container items-center justify-between gap-5">
        <div className="flex items-center gap-3 text-ink">
          <Logo className="h-[22px] w-auto" />
          <div>
            <span className="block text-[15px] font-semibold tracking-wordmark text-ink">
              SIMWORKS
            </span>
            <span className="hidden text-micro text-muted sm:block">
              Simulation intelligence
            </span>
          </div>
        </div>

        <div className="hidden min-w-0 items-center gap-2 rounded-button bg-manila/80 px-4 py-2 text-small text-muted-deep warm-lift lg:flex">
          <span className="h-2 w-2 rounded-full bg-teal" aria-hidden="true" />
          July credential track live
        </div>

        <div className="flex items-center gap-3 md:gap-7">
          <div className="hidden gap-1 text-[15px] font-medium md:flex">
            {NAV_LINKS.map((link) => {
              const className =
                "cursor-pointer rounded-button px-3 py-2 transition-colors " +
                (link.active
                  ? "bg-black text-white"
                  : "text-muted-deep hover:bg-cloud hover:text-ink");
              return link.to ? (
                <Link key={link.label} to={link.to} className={className}>
                  {link.label}
                </Link>
              ) : (
                <span key={link.label} className={className}>
                  {link.label}
                </span>
              );
            })}
          </div>

          <div className="flex h-10 w-10 items-center justify-center rounded-button bg-white text-[12px] font-semibold text-ink soft-edge">
            {AVATAR_INITIALS}
          </div>
        </div>
      </div>
    </nav>
  );
}
