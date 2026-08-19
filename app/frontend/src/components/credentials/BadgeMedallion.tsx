import { getCaseDefinition } from "@/evaluation/rubrics";

export function BadgeMedallion({
  caseId,
  locked = false,
  size = "md",
  premium = false,
}: {
  caseId: string;
  locked?: boolean;
  size?: "sm" | "md" | "lg";
  premium?: boolean;
}) {
  const definition = getCaseDefinition(caseId);
  const dimensions = size === "sm" ? "h-20 w-20" : size === "lg" ? "h-52 w-52" : "h-32 w-32";
  const shape = {
    "first-year-associate-ma-due-diligence": "badge-shape-legal",
    "month-end-close-under-pressure": "badge-shape-accounting",
    "requirements-gathering-workshop": "badge-shape-analyst",
    "kopi-run": "badge-shape-kopi",
    "apac-pilot-pitch": "badge-shape-analyst",
  }[caseId];
  return (
    <div
      className={`${dimensions} ${shape} ${locked ? "" : "badge-earned"} relative grid shrink-0 place-items-center bg-gradient-to-br ${locked ? "from-stone-300 via-stone-400 to-stone-500 grayscale" : definition.badge.palette} shadow-[inset_0_0_0_3px_rgba(255,255,255,.38),inset_0_0_0_8px_rgba(45,30,18,.22),0_16px_30px_rgba(0,0,0,.18)]`}
      role="img"
      aria-label={`${definition.badge.name} badge, ${locked ? "locked" : "earned"}`}
    >
      <div className="absolute inset-[14%] rounded-full border border-white/45 bg-black/10" />
      <span className={`${size === "lg" ? "text-7xl" : size === "sm" ? "text-3xl" : "text-5xl"} relative text-white drop-shadow-md ${locked ? "opacity-55" : ""}`}>
        {definition.badge.symbol}
      </span>
      {premium && !locked ? (
        <span
          className="absolute right-[8%] top-[8%] grid h-7 w-7 place-items-center rounded-full border border-white/70 bg-[#f4d27b] text-xs font-black text-[#4b3310] shadow-md"
          aria-label="Premium outcome accent"
        >
          ✦
        </span>
      ) : null}
    </div>
  );
}
