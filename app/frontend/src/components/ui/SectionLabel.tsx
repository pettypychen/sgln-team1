import type { ReactNode } from "react";

interface SectionLabelProps {
  children: ReactNode;
  className?: string;
}

/** Compact label used for quiet section context. */
export function SectionLabel({ children, className = "" }: SectionLabelProps) {
  return (
    <div
      className={
        "font-mono text-micro uppercase tracking-[0.14em] text-muted " +
        className
      }
    >
      {children}
    </div>
  );
}
