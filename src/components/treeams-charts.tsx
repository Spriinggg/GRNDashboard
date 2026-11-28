"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, LabelList, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DayPoint, HeatRow, WeekdayPoint } from "@/lib/treeams-mock";
import { TARGET } from "@/lib/treeams-mock";
import { cn } from "@/lib/utils";

const axis = { fontSize: 12, fill: "var(--muted-foreground)" } as const;
const box = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 } as const;
const line = (k: string, v: string) => (
  <p key={k} className="flex justify-between gap-6 tabular-nums">
    <span className="text-muted-foreground">{k}</span>
    <b className="font-semibold">{v}</b>
  </p>
);
const tick = (v: number) => `${Math.round(v)}%`;

export type BarRow = { key: string; name: string; sub?: string; pct: number; selected: boolean; tip: [string, string][] };

// Compliance for a few outlets or checklists, against the target. Under the target is red and on target is grey, so red marks
// only what needs a look. Click a bar to pick it, and click it again to let go.
export function ComplianceBars({ rows, hasSelection, onPick, label, hint }: { rows: BarRow[]; hasSelection: boolean; onPick: (key: string) => void; label: string; hint: string }) {
  if (!rows.length) return <p className="py-10 text-center text-sm text-muted-foreground">Nothing to show for this choice.</p>;
  const pick = (d: unknown) => {
    const p = d as { payload?: BarRow; key?: string };
    const k = p.payload?.key ?? p.key;
    if (k) onPick(k);
  };
  return (
    <div role="img" aria-label={label} style={{ height: rows.length * 34 + 34 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 18, right: 52, bottom: 2, left: 0 }} barCategoryGap={8}>
          <CartesianGrid horizontal={false} stroke="var(--border)" />
          <XAxis type="number" hide domain={[0, 100]} />
          <YAxis type="category" dataKey="name" width={140} tickLine={false} axisLine={false} interval={0} tick={{ ...axis, fill: "var(--foreground)" }} tickFormatter={(v: string) => (v.length > 20 ? v.slice(0, 19) + "…" : v)} />
          <ReferenceLine x={TARGET} stroke="var(--muted-foreground)" strokeDasharray="6 5" label={{ value: `Target ${TARGET}%`, position: "top", fill: "var(--muted-foreground)", fontSize: 11 }} />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            content={(p) => {
              const { active, payload } = p as unknown as { active?: boolean; payload?: { payload: BarRow }[] };
              const r = active && payload?.[0]?.payload;
              if (!r) return null;
              return (
                <div style={box} className="min-w-52 px-3 py-2.5 shadow-sm">
                  <p className="font-semibold">{r.name}</p>
                  {r.sub ? <p className="mb-1 text-muted-foreground">{r.sub}</p> : <div className="mb-1" />}
                  {r.tip.map(([k, v]) => line(k, v))}
                  <p className="mt-1.5 text-primary">{r.selected ? "Click to show them all" : hint}</p>
                </div>
              );
            }}
          />
          <Bar dataKey="pct" radius={4} maxBarSize={22} isAnimationActive={false} cursor="pointer" onClick={pick}>
            {rows.map((r) => (
              <Cell key={r.key} fill={r.pct < TARGET ? "var(--primary)" : "var(--muted-foreground)"} fillOpacity={hasSelection && !r.selected ? 0.25 : r.pct < TARGET ? 0.9 : 0.6} />
            ))}
            <LabelList dataKey="pct" position="right" formatter={(v) => `${Math.round(Number(v))}%`} style={{ fontSize: 12, fontWeight: 600, fill: "var(--foreground)" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Compliance each day as a line against the target, with the checklists not started at all as columns behind it.
export function ComplianceTrend({ data, label }: { data: DayPoint[]; label: string }) {
  const lo = Math.max(0, Math.floor(Math.min(...data.map((d) => d.pct), TARGET) - 6));
  return (
    <div role="img" aria-label={label} className="h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={{ stroke: "var(--border)" }} interval={data.length > 12 ? Math.ceil(data.length / 10) - 1 : 0} />
          <YAxis yAxisId="n" tick={axis} tickLine={false} axisLine={false} width={32} allowDecimals={false} domain={[0, (max: number) => Math.max(4, max * 2.2)]} />
          <YAxis yAxisId="pct" orientation="right" domain={[lo, 100]} tick={axis} tickLine={false} axisLine={false} width={44} tickFormatter={tick} />
          <ReferenceLine yAxisId="pct" y={TARGET} stroke="var(--muted-foreground)" strokeDasharray="6 5" />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            content={(p) => {
              const { active, payload } = p as unknown as { active?: boolean; payload?: { payload: DayPoint }[] };
              const d = active && payload?.[0]?.payload;
              if (!d) return null;
              return (
                <div style={box} className="min-w-52 px-3 py-2.5 shadow-sm">
                  <p className="mb-1 font-semibold">{d.label} <span className="font-normal text-muted-foreground">{d.sub}</span></p>
                  {line("Tasks done", `${d.pct.toFixed(1)}%`)}
                  {line("Checklists not started", String(d.notStarted))}
                </div>
              );
            }}
          />
          <Bar yAxisId="n" dataKey="notStarted" fill="var(--muted-foreground)" fillOpacity={0.45} radius={[4, 4, 0, 0]} maxBarSize={26} isAnimationActive={false} />
          <Line yAxisId="pct" type="monotone" dataKey="pct" stroke="var(--primary)" strokeWidth={2} dot={{ r: 2.5, fill: "var(--primary)" }} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// Compliance on each day of the week against the target.
export function WeekdayBars({ data, label }: { data: WeekdayPoint[]; label: string }) {
  const lo = Math.max(0, Math.floor(Math.min(...data.map((d) => d.pct), TARGET) - 12));
  return (
    <div role="img" aria-label={label} className="h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 22, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
          <YAxis tick={axis} tickLine={false} axisLine={false} width={40} domain={[lo, 100]} tickFormatter={tick} />
          <ReferenceLine y={TARGET} stroke="var(--muted-foreground)" strokeDasharray="6 5" label={{ value: `Target ${TARGET}%`, position: "insideTopRight", fill: "var(--muted-foreground)", fontSize: 11 }} />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            content={(p) => {
              const { active, payload } = p as unknown as { active?: boolean; payload?: { payload: WeekdayPoint }[] };
              const d = active && payload?.[0]?.payload;
              if (!d) return null;
              return (
                <div style={box} className="min-w-48 px-3 py-2.5 shadow-sm">
                  <p className="mb-1 font-semibold">{d.label}</p>
                  {line("Tasks done", `${d.pct.toFixed(1)}%`)}
                  {line("Checklists not started", String(d.notStarted))}
                </div>
              );
            }}
          />
          <Bar dataKey="pct" radius={[4, 4, 0, 0]} maxBarSize={52} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.label} fill={d.pct < TARGET ? "var(--primary)" : "var(--muted-foreground)"} fillOpacity={d.pct < TARGET ? 0.9 : 0.6} />
            ))}
            <LabelList dataKey="pct" position="top" formatter={(v) => `${Number(v).toFixed(1)}%`} style={{ fontSize: 12, fontWeight: 600, fill: "var(--foreground)" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// A square is a calm green on target, yellow under it and red well under. A checklist not started at all is red with a cross, so
// a colour is never the only sign. A day the outlet was not open is blank.
// Every row is an outlet (or, for one outlet, a checklist) and every column a day. Look along a row for an outlet that slips, and
// down a column for a day that went wrong everywhere. Details are in a fixed line under the grid and never float over it.
export function HeatGrid({ rows, days, selectedKey, onPick, nameHead, label }: { rows: HeatRow[]; days: { label: string; sub: string }[]; selectedKey?: string | null; onPick?: (key: string) => void; nameHead: string; label: string }) {
  const [at, setAt] = useState<{ row: HeatRow; day: number } | null>(null);
  if (!rows.length) return <p className="py-10 text-center text-sm text-muted-foreground">Nothing to show for this choice.</p>;
  const cols = `repeat(${days.length}, minmax(16px, 1fr))`;
  const h = at ? at.row.cells[at.day] : null;
  return (
    <div>
      <div className="overflow-x-auto" role="img" aria-label={label}>
        <div className="min-w-[640px]" onMouseLeave={() => setAt(null)}>
          <div className="mb-1 grid items-end gap-x-3" style={{ gridTemplateColumns: "150px 1fr 44px" }}>
            <span className="text-xs text-muted-foreground">{nameHead}</span>
            <div className="grid gap-[3px]" style={{ gridTemplateColumns: cols }}>
              {days.map((d, i) => (
                <span key={i} className="text-center text-[11px] leading-none text-muted-foreground" aria-hidden>
                  {days.length <= 10 || i % 3 === 0 ? d.label.split(" ")[0] : ""}
                </span>
              ))}
            </div>
            <span className="text-right text-xs text-muted-foreground">Done</span>
          </div>
          <div className="flex flex-col gap-[3px]">
            {rows.map((r) => (
              <div key={r.key} className={cn("grid items-center gap-x-3 rounded", selectedKey === r.key && "bg-muted/60")} style={{ gridTemplateColumns: "150px 1fr 44px" }}>
                {onPick ? (
                  <button type="button" onClick={() => onPick(r.key)} aria-label={`Look at ${r.name}`} className={cn("truncate rounded text-left text-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring", selectedKey === r.key && "font-semibold text-primary")}>
                    {r.name}
                  </button>
                ) : (
                  <span className="truncate text-sm">{r.name}</span>
                )}
                <div className="grid gap-[3px]" style={{ gridTemplateColumns: cols }}>
                  {r.cells.map((c, i) => (
                    <i
                      key={i}
                      onMouseEnter={() => setAt({ row: r, day: i })}
                      className={cn("flex h-[22px] items-center justify-center rounded-[3px] text-[10px] leading-none font-semibold text-foreground/80", c ? (c.notStarted && c.done === 0 ? "bg-danger/80" : c.pct >= TARGET ? "bg-success/30" : c.pct >= 70 ? "bg-warning/60" : "bg-danger/70") : "bg-muted/50", at?.row === r && at.day === i && "ring-2 ring-foreground/60")}
                    >
                      {c && c.done === 0 ? "×" : ""}
                    </i>
                  ))}
                </div>
                <span className="text-right text-sm font-semibold tabular-nums">{Math.round(r.pct)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <p aria-live="polite" className="mt-3 min-h-5 text-sm text-muted-foreground">
        {at && h ? (
          <>
            <b className="font-semibold text-foreground">{at.row.name}</b>, {days[at.day].label} {days[at.day].sub}: <b className="font-semibold text-foreground tabular-nums">{Math.round(h.pct)}%</b> of tasks done ({h.done} of {h.exp})
            {h.notStarted ? `, ${h.notStarted} ${h.notStarted === 1 ? "checklist" : "checklists"} not started` : ""}
            {h.late ? `, ${h.late} done late` : ""}
          </>
        ) : at ? (
          "Not open on this day."
        ) : (
          "Point at a square to read it."
        )}
      </p>
    </div>
  );
}
