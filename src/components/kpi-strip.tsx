"use client";

import { Tip } from "@/components/tip";
import { cn } from "@/lib/utils";

// Only a figure that needs a person gets a tone. A normal figure, or a zero, has no colour at all, so the coloured
// ones stand out. Red is a problem. Yellow needs attention soon and is never used as text (DESIGN.md rule 3), so
// the warning figure keeps the normal colour and gets a thick yellow underline.
export type KpiTone = "danger" | "warning";
export const kpiNumberClass = (tone: KpiTone | undefined, count: number) =>
  count === 0 || !tone ? "" : tone === "danger" ? "text-danger" : "underline decoration-warning decoration-[5px] underline-offset-[6px]";

// `visual` replaces the number on a stacked strip, for a figure that is a thing and not a count (a channel with its logo).
// `count` is still the spoken value.
export type Kpi = { key: string; label: string; count: number | string; note: string; tone?: KpiTone; on?: boolean; onPick?: () => void; visual?: React.ReactNode };

const base = "relative flex items-center gap-4 px-6 text-left outline-none";
const num = "min-w-12 shrink-0 text-[40px] leading-none font-semibold tabular-nums";

// Figures in one simple strip: a big number and a short phrase. A figure with `onPick` is a button that sets the
// filters for exactly those rows, and the chosen one has a blue line and `aria-pressed`.
//
// `columns={4}` lays four figures in a row from the `lg` breakpoint. `stacked` puts the phrase under the number and
// uses a smaller number (30 px), for figures that are long, such as "RM 4,666,947" (Sales pages).
export function Kpis({ kpis, label, vertical = false, columns = 3, stacked = false }: { kpis: Kpi[]; label: string; vertical?: boolean; columns?: 3 | 4; stacked?: boolean }) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "overflow-hidden rounded-xl bg-card shadow-sm ring-1 ring-foreground/10",
        vertical ? "flex w-full flex-col divide-y" : columns === 4 ? "grid divide-y lg:grid-cols-4 lg:divide-x lg:divide-y-0" : "grid divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0",
      )}
    >
      {kpis.map((k) => {
        const n = typeof k.count === "number" ? k.count : 1;
        const inner = (
          <>
            {stacked ? (
              <span className="flex min-w-0 flex-col gap-1.5">
                {k.visual ? (
                  <span className="flex min-h-[30px] flex-wrap items-center gap-x-3 gap-y-1">{k.visual}</span>
                ) : (
                  <span className={cn("text-3xl leading-none font-semibold tabular-nums", kpiNumberClass(k.tone, n))}>{k.count}</span>
                )}
                <span className="text-sm text-muted-foreground">{k.label}</span>
              </span>
            ) : (
              <>
                <span className={cn(num, kpiNumberClass(k.tone, n))}>{k.count}</span>
                <span className="text-sm text-muted-foreground">{k.label}</span>
              </>
            )}
            {k.onPick ? <span aria-hidden className={cn("absolute bg-primary transition-opacity", vertical ? "inset-y-0 left-0 w-0.5" : "inset-x-0 bottom-0 h-0.5", k.on ? "opacity-100" : "opacity-0")} /> : null}
          </>
        );
        const node = k.onPick ? (
          <button
            key={k.key}
            type="button"
            aria-pressed={!!k.on}
            aria-label={`${k.count} ${k.label}. ${k.note}`}
            onClick={k.onPick}
            className={cn(base, "py-5 transition-colors hover:bg-muted focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset", vertical && "flex-1 py-4")}
          >
            {inner}
          </button>
        ) : (
          <div key={k.key} className={cn(base, "py-5", vertical && "flex-1 py-4")}>
            {inner}
          </div>
        );
        return (
          <Tip key={k.key} text={k.note} block>
            {node}
          </Tip>
        );
      })}
    </div>
  );
}
