import type { ReactNode } from "react";

interface CoverArtProps {
  /** Monospace label shown top-right on the placeholder, e.g. "LEGAL · Cover". */
  label: string;
  /** Cover image URL. When present, renders the photo; otherwise falls back to the gradient placeholder. */
  src?: string;
  /** Aspect ratio, e.g. "16 / 10" (grid) or "16 / 9" (continue card). */
  aspect?: string;
  /** Diagonal gradient tint, e.g. a category accent color. */
  accent?: string;
  /** Optional overlays (badges, progress bar) positioned by the parent. */
  children?: ReactNode;
  className?: string;
}

/**
 * The simulation cover: renders the case's cover photo when `src` is given,
 * falling back to a striped gradient placeholder tinted by category accent.
 */
export function CoverArt({
  label,
  src,
  aspect = "16 / 10",
  accent = "#8a6a3a",
  children,
  className = "",
}: CoverArtProps) {
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden ${className}`}
      style={
        src
          ? { aspectRatio: aspect }
          : {
              aspectRatio: aspect,
              backgroundImage: `linear-gradient(135deg, ${accent} 0%, #111111 130%), repeating-linear-gradient(115deg, rgba(255,255,255,0.09) 0px, rgba(255,255,255,0.09) 1px, transparent 1px, transparent 10px)`,
              backgroundBlendMode: "normal, overlay",
            }
      }
    >
      {src ? (
        <img src={src} alt={label} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <span className="absolute right-4 top-4 z-10 max-w-[55%] text-right font-mono text-[10px] uppercase leading-[1.5] tracking-[0.08em] text-white/70">
          Cinematic placeholder
          <br />
          {label}
        </span>
      )}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(0,0,0,0.28))]" />
      {children}
    </div>
  );
}
