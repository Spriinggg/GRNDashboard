"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import type { Metric, Row } from "@/lib/overview-mock";

const axis = { fontSize: 12, fill: "var(--muted-foreground)" } as const;
const box = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 } as const;

export const fmtFull = (m: Metric, v: number) => (m === "sales" ? "RM " : "") + Math.round(v).toLocaleString("en");
export const fmtShort = (m: Metric, v: number) => (m === "sales" ? "RM " : "") + (Math.abs(v) >= 1000 ? (v / 1000).toFixed(v >= 10000 ? 0 : 1) + "k" : String(Math.round(v)));
export const fmtDelta = (d: number) => `${d >= 0 ? "+" : "−"}${Math.abs(d * 100).toFixed(1)}%`;

type Datum = Row & { id: string; name: string };

// One chart for every level. Outlets are ranked bars going right; months, days and hours are columns in time order.
// Select a bar to open the next level down. At the last level the bars are not clickable.
export function DrillChart({ rows, horizontal, metric, avg, compare, label, onPick }: { rows: Row[]; horizontal: boolean; metric: Metric; avg?: number; compare: string; label: string; onPick?: (key: string) => void }) {
  const reduce = useReducedMotion();
  if (!rows.length) return <p className="py-10 text-center text-sm text-muted-foreground">Nothing to show for this selection.</p>;
  const data: Datum[] = rows.map((r) => ({ ...r, id: r.key, name: r.label }));
  const best = rows.reduce((a, b) => (b.value > a.value ? b : a));
  const desc = `${label}. ${rows.length} bars. Highest is ${best.label} at ${fmtFull(metric, best.value)}.${onPick ? " Select a bar to go one level deeper." : ""}`;
  const pick = (d: unknown) => {
    const p = d as { id?: string; payload?: { id: string } };
    const id = p.payload?.id ?? p.id;
    if (onPick && id) onPick(id);
  };
  const cells = data.map((r) => <Cell key={r.id} fill="var(--primary)" fillOpacity={r.strong ? 1 : 0.5} />);
  const tip = (
    <Tooltip
      cursor={{ fill: "var(--muted)" }}
      content={(p) => {
        const { active, payload } = p as unknown as { active?: boolean; payload?: { payload: Datum }[] };
        const r = active && payload?.[0]?.payload;
        if (!r) return null;
        return (
          <div style={box} className="px-3 py-2 shadow-sm">
            <p className="font-semibold">
              {r.label}
              {r.sub ? <span className="ml-1.5 font-normal text-muted-foreground">{r.sub}</span> : null}
            </p>
            <p className="tabular-nums">{fmtFull(metric, r.value)}</p>
            {r.delta !== null ? (
              <p className="tabular-nums text-muted-foreground">
                {fmtDelta(r.delta)} {compare}
              </p>
            ) : null}
            {r.fc !== null ? <p className="tabular-nums text-muted-foreground">Food cost {r.fc.toFixed(1)}%</p> : null}
            {onPick ? <p className="mt-1 text-primary">Click to open</p> : null}
          </div>
        );
      }}
    />
  );

  if (horizontal) {
    return (
      <div role="img" aria-label={desc} style={{ height: rows.length * 34 + 16 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 2, right: 104, bottom: 2, left: 0 }} barCategoryGap={6}>
            <CartesianGrid horizontal={false} stroke="var(--border)" />
            <XAxis type="number" hide domain={[0, "dataMax"]} />
            <YAxis type="category" dataKey="name" width={132} tickLine={false} axisLine={false} interval={0} tick={{ ...axis, fill: "var(--foreground)" }} tickFormatter={(v: string) => (v.length > 18 ? v.slice(0, 17) + "…" : v)} />
            {tip}
            <Bar dataKey="value" radius={4} isAnimationActive={!reduce} onClick={pick} cursor={onPick ? "pointer" : "default"}>
              {cells}
              <LabelList dataKey="value" position="right" formatter={(v) => fmtFull(metric, Number(v))} style={{ fontSize: 12, fontWeight: 600, fill: "var(--foreground)" }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  const dense = rows.length > 16;
  return (
    <div role="img" aria-label={desc} className="h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 22, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="name" tick={axis} tickLine={false} axisLine={{ stroke: "var(--border)" }} interval={0} />
          <YAxis tick={axis} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => fmtShort(metric, Number(v)).replace("RM ", "")} />
          {avg ? <ReferenceLine y={avg} stroke="var(--muted-foreground)" strokeDasharray="6 5" label={{ value: `avg ${fmtShort(metric, avg)}`, position: "insideTopRight", fill: "var(--muted-foreground)", fontSize: 11 }} /> : null}
          {tip}
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={56} isAnimationActive={!reduce} onClick={pick} cursor={onPick ? "pointer" : "default"}>
            {cells}
            {dense ? null : <LabelList dataKey="value" position="top" formatter={(v) => fmtShort(metric, Number(v))} style={{ fontSize: 12, fontWeight: 600, fill: "var(--foreground)" }} />}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
