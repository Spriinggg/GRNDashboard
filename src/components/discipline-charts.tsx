"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { cn } from "@/lib/utils";

// The charts of Count & GRN. They draw the same days as the table below and filter it: click a bar, a column or a square and the
// table narrows to it, click again to let go. Every chart has a text description for screen readers.
const axis = { fontSize: 12, fill: "var(--muted-foreground)" } as const;
const box = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 } as const;
const line = (k: string, v: React.ReactNode) => (
  <p key={k} className="flex justify-between gap-6 tabular-nums">
    <span className="text-muted-foreground">{k}</span>
    <b className="font-semibold">{v}</b>
  </p>
);

export type CheckKey = "count" | "grn" | "ded";
export const CHECK_LABEL: Record<CheckKey, string> = { count: "Stock count", grn: "GRN", ded: "POS deductions" };

export type CheckRow = { key: CheckKey; done: number; total: number };

// How many of the days each check was done, as a share. A check done on every day is green, anything less is yellow. Click a bar
// to show the days where that check is missing.
export function CheckBars({ rows, selected, onPick, label }: { rows: CheckRow[]; selected: CheckKey | ""; onPick: (key: CheckKey) => void; label: string }) {
  const reduce = useReducedMotion();
  const data = rows.map((r) => ({ ...r, name: CHECK_LABEL[r.key], pct: r.total ? (r.done / r.total) * 100 : 0, text: `${r.done} of ${r.total}` }));
  return (
    <div role="img" aria-label={label} className="cursor-pointer" style={{ height: rows.length * 52 + 8 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 2, right: 70, bottom: 0, left: 0 }} barCategoryGap={14}>
          <CartesianGrid horizontal={false} stroke="var(--border)" />
          <XAxis type="number" hide domain={[0, 100]} />
          <YAxis type="category" dataKey="name" width={104} tickLine={false} axisLine={false} interval={0} tick={{ ...axis, fill: "var(--foreground)" }} />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            content={(p) => {
              const { active, payload } = p as unknown as { active?: boolean; payload?: { payload: (typeof data)[number] }[] };
              const d = active && payload?.[0]?.payload;
              if (!d) return null;
              return (
                <div style={box} className="min-w-44 px-3 py-2.5 shadow-sm">
                  <p className="mb-1 font-semibold">{d.name}</p>
                  {line("Done", d.text)}
                  {line("Missing", String(d.total - d.done))}
                  <p className="mt-1.5 text-primary">{d.key === selected ? "Click to show every day" : d.total - d.done ? "Click to show the days missing this" : "Nothing is missing"}</p>
                </div>
              );
            }}
          />
          <Bar dataKey="pct" radius={4} maxBarSize={24} isAnimationActive={!reduce} onClick={(d) => onPick((d as unknown as { key: CheckKey }).key)}>
            {data.map((d) => (
              <Cell key={d.key} fill={d.pct >= 100 ? "var(--success)" : "var(--warning)"} fillOpacity={selected && selected !== d.key ? 0.3 : 0.9} />
            ))}
            <LabelList dataKey="text" position="right" style={{ fontSize: 12, fontWeight: 600, fill: "var(--foreground)" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export type DayPoint = { iso: string; label: string; sub: string; count: number; grn: number; ded: number; days: number; complete: number };

// One column for each day. The column is stacked by the checks that were missing, counted over the outlets, so a tall column is a
// day when a lot went wrong. Click a column to show only that day in the table.
export function GapTrend({ data, selected, onPick, label }: { data: DayPoint[]; selected: string; onPick: (iso: string) => void; label: string }) {
  const reduce = useReducedMotion();
  const fade = (iso: string) => (selected && selected !== iso ? 0.3 : 1);
  return (
    <div role="img" aria-label={label} className="h-[260px] cursor-pointer">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: 4, bottom: 0, left: 0 }}
          onClick={(state) => {
            // The column under the pointer: its position in the data (Recharts 3), or its payload (older versions).
            const s = state as unknown as { activeTooltipIndex?: number | string; activePayload?: { payload: DayPoint }[] };
            const i = s.activeTooltipIndex === undefined ? -1 : Number(s.activeTooltipIndex);
            const iso = data[i]?.iso ?? s.activePayload?.[0]?.payload.iso;
            if (iso) onPick(iso);
          }}
        >
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={{ stroke: "var(--border)" }} interval={data.length > 14 ? Math.ceil(data.length / 10) - 1 : 0} />
          <YAxis tick={axis} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            content={(p) => {
              const { active, payload } = p as unknown as { active?: boolean; payload?: { payload: DayPoint }[] };
              const d = active && payload?.[0]?.payload;
              if (!d) return null;
              return (
                <div style={box} className="min-w-48 px-3 py-2.5 shadow-sm">
                  <p className="mb-1 font-semibold">{d.label} <span className="font-normal text-muted-foreground">{d.sub}</span></p>
                  {line("Complete", `${d.complete} of ${d.days}`)}
                  {line("Stock count missing", String(d.count))}
                  {line("GRN missing", String(d.grn))}
                  {line("POS deductions missing", String(d.ded))}
                  <p className="mt-1.5 text-primary">{d.iso === selected ? "Click to show every day" : "Click to show only this day"}</p>
                </div>
              );
            }}
          />
          <Bar dataKey="count" stackId="gap" fill="var(--muted-foreground)" isAnimationActive={!reduce}>
            {data.map((d) => <Cell key={d.iso} fillOpacity={0.75 * fade(d.iso)} />)}
          </Bar>
          <Bar dataKey="grn" stackId="gap" fill="var(--warning)" isAnimationActive={!reduce}>
            {data.map((d) => <Cell key={d.iso} fillOpacity={fade(d.iso)} />)}
          </Bar>
          <Bar dataKey="ded" stackId="gap" fill="var(--muted-foreground)" radius={[3, 3, 0, 0]} isAnimationActive={!reduce}>
            {data.map((d) => <Cell key={d.iso} fillOpacity={0.4 * fade(d.iso)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export type GridRow = { key: string; name: string; missing: number; cells: ({ iso: string; count: boolean; grn: boolean; ded: boolean } | null)[] };

// Every outlet is a row and every day a column. A tick is a complete day, an exclamation mark is a day with something missing, and an
// empty square is a day with no file. Look along a row for an outlet that keeps slipping and down a column for a bad day. Point at a
// square to read it, click it to open that outlet and day in the table. Details are in a fixed line under the grid.
export function DayGrid({ rows, days, picked, day, onPickOutlet, onPickCell, label }: { rows: GridRow[]; days: { iso: string; label: string }[]; picked: string; day: string; onPickOutlet: (key: string) => void; onPickCell: (key: string, iso: string) => void; label: string }) {
  const [at, setAt] = useState<{ row: GridRow; i: number } | null>(null);
  if (!rows.length) return <p className="py-8 text-center text-sm text-muted-foreground">No days loaded for these filters.</p>;
  const cols = `repeat(${days.length}, minmax(18px, 1fr))`;
  const c = at ? at.row.cells[at.i] : null;
  const word = (ok: boolean) => (ok ? "done" : "missing");
  return (
    <div>
      <div className="overflow-x-auto" role="img" aria-label={label}>
        <div className="min-w-[560px]" onMouseLeave={() => setAt(null)}>
          <div className="mb-1 grid items-end gap-x-3" style={{ gridTemplateColumns: "150px 1fr 40px" }}>
            <span className="text-xs text-muted-foreground">Outlet</span>
            <div className="grid gap-[3px]" style={{ gridTemplateColumns: cols }}>
              {days.map((d, i) => (
                <span key={d.iso} aria-hidden className="text-center text-[11px] leading-none text-muted-foreground">{days.length <= 10 || i % 3 === 0 ? d.label.split(" ")[0] : ""}</span>
              ))}
            </div>
            <span className="text-right text-xs text-muted-foreground">Gaps</span>
          </div>
          <div className="flex flex-col gap-[3px]">
            {rows.map((r) => (
              <div key={r.key} className={cn("grid items-center gap-x-3 rounded", picked === r.key && "bg-muted/60")} style={{ gridTemplateColumns: "150px 1fr 40px" }}>
                <button type="button" onClick={() => onPickOutlet(r.key)} aria-label={`Look at ${r.name}`} className={cn("truncate rounded text-left text-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring", picked === r.key && "font-semibold text-primary")}>
                  {r.name}
                </button>
                <div className="grid gap-[3px]" style={{ gridTemplateColumns: cols }}>
                  {r.cells.map((cell, i) => {
                    const ok = cell && cell.count && cell.grn && cell.ded;
                    return (
                      <button
                        key={days[i].iso}
                        type="button"
                        disabled={!cell}
                        onMouseEnter={() => setAt({ row: r, i })}
                        onFocus={() => setAt({ row: r, i })}
                        onClick={() => cell && onPickCell(r.key, cell.iso)}
                        aria-label={cell ? `${r.name}, ${days[i].label}: ${ok ? "every check done" : "something missing"}` : `${r.name}, ${days[i].label}: no file`}
                        className={cn(
                          "flex h-[22px] items-center justify-center rounded-[3px] text-[11px] leading-none font-bold text-foreground/80 outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          !cell ? "bg-muted/50" : ok ? "bg-success/30" : "bg-warning/60",
                          cell && "cursor-pointer",
                          cell && day === cell.iso && picked === r.key && "ring-2 ring-foreground/60",
                        )}
                      >
                        {cell ? (ok ? "✓" : "!") : ""}
                      </button>
                    );
                  })}
                </div>
                <span className="text-right text-sm font-semibold tabular-nums">{r.missing}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <p aria-live="polite" className="mt-3 min-h-5 text-sm text-muted-foreground">
        {at && c ? (
          <>
            <b className="font-semibold text-foreground">{at.row.name}</b>, {days[at.i].label}: stock count {word(c.count)}, GRN {word(c.grn)}, POS deductions {word(c.ded)}
          </>
        ) : at ? (
          "No file for this day."
        ) : (
          "Point at a square to read it, click it to open that day in the table."
        )}
      </p>
    </div>
  );
}
