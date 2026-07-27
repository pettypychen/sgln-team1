import { parseCsv } from "@/components/ui/CsvTable";

interface KopiMenuCardsProps {
  content: string;
}

/** Flavor copy per item code, matching the onboarding menu design. */
const DESCRIPTIONS: Record<string, string> = {
  K01: "The original — coffee with condensed milk, sweet and full-bodied.",
  K02: "Black coffee, no milk — bold and roasty, kept sweet.",
  K03: "Black coffee, no milk, no sugar — pure and unsweetened.",
  K04: "Coffee with evaporated milk — lighter, milkier, gently sweet.",
  K05: "Coffee with evaporated milk, less sugar — smooth and balanced.",
  K06: "Kopi over ice — condensed milk, sweet, served cold.",
};

/** Base sphere colour keyed by milk modifier, from darkest (no milk) to lightest. */
function sphereColor(milk: string): { light: string; dark: string } {
  const value = milk.toLowerCase();
  if (value.includes("no milk")) return { light: "#5a4326", dark: "#241708" };
  if (value.includes("evaporated")) return { light: "#c8a877", dark: "#8a6a3c" };
  // condensed milk / default
  return { light: "#b28f56", dark: "#6f5227" };
}

function isIced(temperature: string): boolean {
  const value = temperature.toLowerCase();
  return value.includes("ice") || value.includes("peng");
}

/** Circular drink illustration: a gradient sphere, or diagonal stripes when iced. */
function DrinkSphere({ milk, temperature }: { milk: string; temperature: string }) {
  const { light, dark } = sphereColor(milk);
  const iced = isIced(temperature);
  const background = iced
    ? `repeating-linear-gradient(45deg, ${light} 0 10px, ${dark} 10px 20px)`
    : `radial-gradient(circle at 34% 30%, ${light} 0%, ${dark} 78%)`;
  return (
    <span
      aria-hidden="true"
      className="h-24 w-24 flex-none rounded-full ring-4 ring-white shadow-inner"
      style={{ background }}
    />
  );
}

/**
 * Renders the kopi menu CSV as a card grid (drink illustration, name, item code,
 * description, and modifier chips) instead of a flat table.
 */
export function KopiMenuCards({ content }: KopiMenuCardsProps) {
  const [headers = [], ...rows] = parseCsv(content);
  if (!headers.length) {
    return <p className="m-0 text-small text-muted">No items to display.</p>;
  }

  const index = (name: string) =>
    headers.findIndex((header) => header.toLowerCase().includes(name));
  const codeCol = index("item code");
  const nameCol = index("drink name");
  const milkCol = index("milk");
  const sugarCol = index("sugar");
  const tempCol = index("temperature");
  const priceCol = index("price");

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {rows.map((cells, rowIndex) => {
        const code = cells[codeCol] ?? "";
        const name = cells[nameCol] ?? "";
        const milk = cells[milkCol] ?? "";
        const sugar = cells[sugarCol] ?? "";
        const temperature = cells[tempCol] ?? "";
        const price = cells[priceCol] ?? "";
        const chips = [milk, sugar, temperature].filter(Boolean);
        return (
          <article
            key={code || rowIndex}
            className="flex gap-4 rounded-panel border border-hairline bg-white p-4"
          >
            <DrinkSphere milk={milk} temperature={temperature} />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <h3 className="m-0 font-display text-2xl leading-tight text-ink">{name}</h3>
                <div className="flex flex-none flex-col items-end gap-1">
                  <span className="rounded-button bg-cloud px-2 py-1 font-mono text-micro text-muted">
                    {code}
                  </span>
                  {price ? (
                    <span className="font-semibold text-small text-ink">SGD {price}</span>
                  ) : null}
                </div>
              </div>
              <p className="mb-3 mt-1 text-small text-muted-deep">{DESCRIPTIONS[code] ?? ""}</p>
              <div className="flex flex-wrap gap-2">
                {chips.map((chip, chipIndex) => (
                  <span
                    key={`${chipIndex}-${chip}`}
                    className="rounded-button bg-cloud px-2.5 py-1 text-micro font-medium text-ink"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
