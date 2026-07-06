import type { ReactNode } from "react";

interface CoverArtProps {
  /** Monospace label centered on the art, e.g. "LEGAL · Cover". */
  label: string;
  /** Cover image URL; when set, renders real art instead of the placeholder. */
  src?: string;
  /** Aspect ratio, e.g. "16 / 10" (grid) or "16 / 9" (continue card). */
  aspect?: string;
  /** Optional overlays (badges, progress bar) positioned by the parent. */
  children?: ReactNode;
  className?: string;
}

/**
 * The simulation cover. Renders real cover media when provided, otherwise falls
 * back to a quiet product-surface placeholder.
 */
export function CoverArt({
  label,
  src,
  aspect = "16 / 10",
  children,
  className = "",
}: CoverArtProps) {
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden bg-cloud ${className}`}
      style={{
        aspectRatio: aspect,
        backgroundImage: src
          ? undefined
          : "linear-gradient(135deg, #ffffff 0%, #f5f2ef 100%)",
      }}
    >
      {src ? (
        <img
          src={src}
          alt={label}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover contrast-[1.02] transition-transform duration-500 group-hover:scale-[1.025]"
        />
      ) : (
        <span className="font-mono text-micro text-muted">
          {label}
        </span>
      )}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(0,0,0,0.2))]" />
      {children}
    </div>
  );
}
