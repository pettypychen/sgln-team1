import { Link, useNavigate } from "react-router-dom";
import { Logo } from "./Logo";
import { APP_VERSION } from "@/lib/version";
import { clearParticipantName, getParticipantName } from "@/participant/session";

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

/** Compact product header for the simulation marketplace. */
export function Navbar() {
  const navigate = useNavigate();
  const participantName = getParticipantName();

  function handleLogout() {
    clearParticipantName();
    navigate("/login", { replace: true });
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-hairline bg-white/90 px-5 py-3 backdrop-blur-xl md:px-12">
      <div className="mx-auto flex max-w-container items-center justify-between gap-5">
        <div className="flex items-center gap-3 text-ink">
          <Logo className="h-[22px] w-auto" />
          <div>
            <span className="block text-[15px] font-semibold tracking-wordmark text-ink">
              SIMWORKS
            </span>
            <span className="hidden items-center gap-1.5 text-micro text-muted sm:flex">
              Simulation intelligence
              <span className="rounded bg-cloud px-1 py-0.5 font-mono text-[10px] text-muted-deep">v{APP_VERSION}</span>
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

          {participantName ? (
            <div className="flex items-center gap-3">
              <span className="text-small font-medium text-ink">{participantName}</span>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-button bg-white px-4 py-2 text-small soft-edge hover:bg-cloud"
              >
                Log out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </nav>
  );
}
