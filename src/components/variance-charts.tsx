"use client";

import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, LabelList, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtFull, fmtShort } from "@/components/drill-chart";

const axis = { fontSize: 12, fill: "var(--muted-foreground)" } as const;
const box = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 } as const;
const rmk = (v: number) => fmtShort("sales", v).replace("RM ", "");

export type ShortRow = { key: string; name: string; sub?: string; value: number; text: string; selected: boolean; tip: [string, string][] };

// Horizontal bars of how much was short, largest first. Used for the outlets and for the items, so the two read the same.
// Select a bar to filter the rest of the page to it, and select it again to let go. While one bar is chosen the others fade.
export function ShortBars({ rows, hasSelection, onPick, label, noun }: { rows: ShortRow[]; hasSelection: boolean; onPick: (key: string) => void; label: string; noun: string }) {
  if (!rows.length) return <p className="py-10 text-center text-sm text-muted-foreground">Nothing is short for this choice.</p>;
  const pick = (d: unknown) => {
    const p = d as { payload?: ShortRow; key?: string };
    const k = p.payload?.key ?? p.key;
    if (k) onPick(k);
  };
  return (
    <div role="img" aria-label={label} style={{ height: rows.length * 34 + 16 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 2, right: 110, bottom: 2, left: 0 }} barCategoryGap={8}>
          <CartesianGrid horizontal={false} stroke="var(--border)" />
          <XAxis type="number" hide domain={[0, "dataMax"]} />
          <YAxis type="category" dataKey="name" width={150} tickLine={false} axisLine={false} interval={0} tick={{ ...axis, fill: "var(--foreground)" }} tickFormatter={(v: string) => (v.length > 22 ? v.slice(0, 21) + "…" : v)} />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            content={(p) => {
              const { active, payload } = p as unknown as { active?: boolean; payload?: { payload: ShortRow }[] };
              const r = active && payload?.[0]?.payload;
              if (!r) return null;
              return (
                <div style={box} className="min-w-52 px-3 py-2.5 shadow-sm">
                  <p className="font-semibold">{r.name}</p>
                  {r.sub ? <p className="mb-1 text-muted-foreground">{r.sub}</p> : <div className="mb-1" />}
                  {r.tip.map(([k, v]) => (
                    <p key={k} className="flex justify-between gap-6 tabular-nums"><span className="text-muted-foreground">{k}</span><b className="font-semibold">{v}</b></p>
                  ))}
                  <p className="mt-1.5 text-primary">{r.selected ? `Click to show every ${noun}` : `Click to look at this ${noun}`}</p>
                </div>
              );
            }}
          />
          <Bar dataKey="value" radius={4} maxBarSize={22} isAnimationActive={false} cursor="pointer" onClick={pick}>
            {rows.map((r) => (
              <Cell key={r.key} fill="var(--primary)" fillOpacity={hasSelection && !r.selected ? 0.28 : 0.9} />
            ))}
            <LabelList dataKey="text" position="right" style={{ fontSize: 12, fontWeight: 600, fill: "var(--foreground)" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export type DayPoint = { label: string; sub: string; short: number; net: number; pct: number };

// What was short on each day, as columns, and that as a share of the day's sales, as a line.
export function DayTrend({ data, label }: { data: DayPoint[]; label: string }) {
  return (
    <div role="img" aria-label={label} className="h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={{ stroke: "var(--border)" }} interval={data.length > 12 ? Math.ceil(data.length / 10) - 1 : 0} />
          <YAxis yAxisId="rm" tick={axis} tickLine={false} axisLine={false} width={52} tickFormatter={(v) => rmk(Number(v))} />
          <YAxis yAxisId="pct" orientation="right" tick={axis} tickLine={false} axisLine={false} width={44} tickFormatter={(v) => `${Number(v).toFixed(1)}%`} />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            content={(p) => {
              const { active, payload } = p as unknown as { active?: boolean; payload?: { payload: DayPoint }[] };
              const d = active && payload?.[0]?.payload;
              if (!d) return null;
              return (
                <div style={box} className="min-w-52 px-3 py-2.5 shadow-sm">
                  <p className="mb-1 font-semibold">{d.label} <span className="font-normal text-muted-foreground">{d.sub}</span></p>
                  <p className="flex justify-between gap-6 tabular-nums"><span className="text-muted-foreground">Short</span><b className="font-semibold">{fmtFull("sales", d.short)}</b></p>
                  <p className="flex justify-between gap-6 tabular-nums"><span className="text-muted-foreground">Net of what was over</span><b className="font-semibold">{d.net < 0 ? "−" : ""}{fmtFull("sales", Math.abs(d.net))}</b></p>
                  <p className="flex justify-between gap-6 tabular-nums"><span className="text-muted-foreground">Share of sales</span><b className="font-semibold">{d.pct.toFixed(2)}%</b></p>
                </div>
              );
            }}
          />
          <Bar yAxisId="rm" dataKey="short" fill="var(--primary)" fillOpacity={0.85} radius={[4, 4, 0, 0]} maxBarSize={30} isAnimationActive={false} />
          <Line yAxisId="pct" type="monotone" dataKey="pct" stroke="var(--foreground)" strokeWidth={2} dot={{ r: 2.5, fill: "var(--foreground)" }} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
