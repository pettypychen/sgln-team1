import type { ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  /** Fill color (defaults to warm stone). */
  color?: string;
  className?: string;
}

export function Badge({ children, color = "#f5f2ef", className = "" }: BadgeProps) {
  return (
    <div
      className={
        "rounded-button px-3 py-1.5 text-micro font-precise text-ink warm-lift " +
        className
      }
      style={{ background: color }}
    >
      {children}
    </div>
  );
}
