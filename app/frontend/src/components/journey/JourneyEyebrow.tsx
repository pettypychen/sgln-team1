interface JourneyEyebrowProps {
  children: string;
  /** Set when the eyebrow sits on a dark surface. */
  dark?: boolean;
}

/** Section eyebrow: quiet uppercase label with a hairline rule running out. */
export function JourneyEyebrow({ children, dark = false }: JourneyEyebrowProps) {
  return (
    <div className="mb-2 flex items-baseline gap-4">
      <div
        className={
          "text-small font-medium uppercase tracking-[0.14em] " +
          (dark ? "text-amber" : "text-teal")
        }
      >
        {children}
      </div>
      <div
        className={"h-px flex-1 " + (dark ? "bg-white/15" : "bg-hairline")}
      />
    </div>
  );
}
