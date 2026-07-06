import type { TrustPartner } from "@/types";

interface TrustBarProps {
  partners: TrustPartner[];
}

/**
 * Monochrome SVG logo marks, one per Singapore partner firm. Each is drawn on a
 * 24x24 grid in `currentColor` so it inherits the surrounding wordmark color and
 * stays crisp at any size.
 */
const LOGO_MARKS: Record<TrustPartner["logo"], JSX.Element> = {
  // Tembusu tree — canopy over a short trunk (as on the $5 note).
  tembusu: (
    <>
      <path
        d="M12 3.2c-3.4 0-5.8 2.2-5.8 5 0 2.5 1.9 4.3 4.3 4.7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M12 3.2c3.4 0 5.8 2.2 5.8 5 0 2.6-2 4.4-4.6 4.7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M12 8v13M12 14l-3.3-2.4M12 12.5l3.3-2.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </>
  ),
  // Raffles & Tan — a classical column, nodding to the old audit houses.
  raffles: (
    <>
      <path
        d="M5 6h14M6.5 8.5h11M8 8.5v9M12 8.5v9M16 8.5v9M6 20h12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 5.5c1.6-1.4 3.5-2.1 8-2.1s6.4.7 8 2.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </>
  ),
  // Straits Union Bank — three currents of the Singapore Strait in a roundel.
  straits: (
    <>
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M6.5 9.5c1.4-1.4 2.8-1.4 4.2 0s2.8 1.4 4.2 0M6.5 13c1.4-1.4 2.8-1.4 4.2 0s2.8 1.4 4.2 0M6.5 16.5c1.4-1.4 2.8-1.4 4.2 0s2.8 1.4 4.2 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </>
  ),
  // Merlion Advisory — a lion's crest cresting a wave.
  merlion: (
    <>
      <path
        d="M8 11c0-2.8 1.9-5 4.4-5 1 0 1.7.3 2.3.8-.5.2-.8.7-.8 1.3 0 .3.1.6.3.8-1.3.1-2 .9-2 2.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d="M8 11c-.9.5-1.6 1.4-1.9 2.6M12.2 11.1c.2 1.2.9 2.1 1.9 2.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M4 16.5c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0 3-1.5 4.5 0 3 1.5 4.5 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </>
  ),
  // Orchard Partners — a five-petal Vanda orchid, Singapore's national flower.
  orchard: (
    <>
      <circle cx="12" cy="12" r="2.1" fill="currentColor" />
      <path
        d="M12 9.9c-.4-2.4.4-4.4 0-6.1-.4 1.7.4 3.7 0 6.1ZM13.5 11c1.9-1.5 3.9-2 5.3-3-1.6.6-3.2 2-5.3 3ZM13.1 13.6c2.4.4 4 1.7 5.7 2-1.7 0-3.5-1.1-5.7-2ZM10.9 13.6c-2.2.9-4 2-5.7 2 1.7-.3 3.3-1.6 5.7-2ZM10.5 11c-2.1-1-3.7-2.4-5.3-3 1.4 1 3.4 1.5 5.3 3Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </>
  ),
};

/** Practitioner and employer calibration evidence strip. */
export function TrustBar({ partners }: TrustBarProps) {
  return (
    <section className="border-y border-hairline bg-white">
      <div className="mx-auto grid max-w-container grid-cols-1 gap-8 px-5 py-12 md:px-12 lg:grid-cols-[0.85fr_1.35fr] lg:items-center">
        <div>
          <div className="mb-3 text-small font-medium text-muted-deep">
            Employer-calibrated evidence
          </div>
          <p className="m-0 max-w-[48ch] font-display text-[34px] font-light leading-[1.1] text-ink">
            Scenarios are shaped with practitioners, then scored around the
            artifacts hiring teams can actually inspect.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {partners.map((partner) => (
            <div
              key={partner.name}
              className="min-h-[92px] rounded-panel bg-paper p-4 text-muted-deep soft-edge"
            >
              <div className="mb-3 flex items-center gap-2 text-ink">
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-[24px] w-[24px] shrink-0"
                >
                  {LOGO_MARKS[partner.logo]}
                </svg>
                <span className="font-mono text-micro text-muted">
                  Verified
                </span>
              </div>
              <span className="block text-[14px] font-semibold leading-snug text-ink">
                {partner.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
