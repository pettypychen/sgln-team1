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
        "text-small font-medium text-muted-deep " +
        className
      }
    >
      {children}
    </div>
  );
}
