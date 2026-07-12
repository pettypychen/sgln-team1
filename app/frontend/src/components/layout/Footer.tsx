interface FooterColumn {
  title: string;
  links: string[];
}

const FOOTER_COLUMNS: FooterColumn[] = [
  { title: "Product", links: ["Marketplace", "My Simulations", "Credentials"] },
  { title: "Company", links: ["About", "Partners", "Contact"] },
  { title: "Legal", links: ["Privacy", "Terms"] },
];

/** Quiet site footer with durable workspace links. */
export function Footer() {
  return (
    <footer className="bg-paper">
      <div className="mx-auto grid max-w-container grid-cols-1 gap-10 px-5 pb-11 pt-12 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:px-12">
        <div>
          <div className="mb-4 text-[15px] font-semibold tracking-wordmark text-ink">
            SIMWORKS
          </div>
          <p className="m-0 max-w-[36ch] text-[14px] leading-[1.5] text-muted-deep">
            Workplace simulations that turn practice into proof. Learn the job by
            doing the job.
          </p>
        </div>

        {FOOTER_COLUMNS.map((col) => (
          <div key={col.title}>
            <div className="mb-4 text-small font-medium text-muted-deep">
              {col.title}
            </div>
            <div className="flex flex-col gap-[11px] text-[14px] text-footer">
              {col.links.map((link) => (
                <span
                  key={link}
                  className="cursor-pointer transition-colors hover:text-ink"
                >
                  {link}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mx-auto max-w-container border-t border-hairline px-5 py-6 text-small text-muted md:px-12">
        © 2026 SimWorks. All rights reserved. · Built for the future of work.
      </div>
    </footer>
  );
}
