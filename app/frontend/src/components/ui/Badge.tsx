import type { ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  /** Fill color (defaults to warm stone). */
  color?: string;
  className?: string;
}

export function Badge({ children, color = "#f2f2f2", className = "" }: BadgeProps) {
  return (
    <div
      className={
        "rounded-button px-3 py-1.5 font-mono text-micro uppercase tracking-[0.08em] text-ink warm-lift " +
        className
      }
      style={{ background: color }}
    >
      {children}
    </div>
  );
}
