"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Store } from "@/lib/types";
import { RM, RM2, datesFor, fmtS, totVar } from "@/lib/calc";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

// Charts use var(--primary), var(--border), var(--danger) and var(--muted-foreground) only (DESIGN.md 2.6).
// Every chart has a written description for screen readers. Titles say what is plotted, so there are no legends.
const axis = { fontSize: 12, fill: "var(--muted-foreground)" } as const;

export type BarRow = { label: string; value: number; key: string };

// Bars that start at zero and go left for a shortfall and right for a surplus. Select a bar to open it.
export function VarianceBars({ rows, onPick }: { rows: BarRow[]; onPick: (key: string) => void }) {
  const reduce = useReducedMotion();
  if (!rows.length) return null;
  const desc = `Variance for ${rows.length} items. Largest shortfall ${rows[0].label} at ${RM2(rows[0].value)}.`;
  return (
    <div role="img" aria-label={desc} style={{ height: rows.length * 44 + 16 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 56, bottom: 4, left: 0 }} barCategoryGap={10}>
            <CartesianGrid horizontal={false} stroke="var(--border)" />
            <XAxis type="number" hide domain={[(min: number) => Math.min(min * 1.35, -1), (max: number) => Math.max(max * 1.35, 1)]} />
            <YAxis type="category" dataKey="label" width={160} tickLine={false} axisLine={false} tick={{ ...axis, fill: "var(--foreground)" }} tickFormatter={(v: string) => (v.length > 22 ? v.slice(0, 21) + "…" : v)} />
            <ReferenceLine x={0} stroke="var(--border)" />
            <Tooltip cursor={{ fill: "var(--muted)" }} formatter={(v) => RM2(Number(v))} labelStyle={{ color: "var(--foreground)" }} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="value" radius={4} isAnimationActive={!reduce} onClick={(d) => onPick((d as unknown as BarRow).key)} cursor="pointer">
              {rows.map((r) => (
                <Cell key={r.key} fill={r.value < 0 ? "var(--danger)" : "var(--muted-foreground)"} />
              ))}
              <LabelList dataKey="value" position="right" formatter={(v) => RM(Number(v))} style={{ fontSize: 12, fontWeight: 600, fill: "var(--foreground)" }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
    </div>
  );
}

export function TrendChart({ store, ok }: { store: Store; ok: string }) {
  const reduce = useReducedMotion();
  const ds = datesFor(store, ok);
  if (ds.length < 2) return <p className="text-sm text-muted-foreground">Upload at least two days for this outlet to see the trend.</p>;
  const pts = ds.map((dt) => ({ label: fmtS(dt), value: Math.round(totVar(store[ok + "|" + dt])) }));
  const worst = pts.reduce((a, b) => (b.value < a.value ? b : a));
  return (
    <div role="img" aria-label={`Daily food variance for ${pts.length} days. Worst day ${worst.label} at ${RM(worst.value)}.`} className="h-[240px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={pts} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={{ stroke: "var(--border)" }} interval="preserveStartEnd" />
          <YAxis tick={axis} tickLine={false} axisLine={false} width={64} tickFormatter={(v) => RM(Number(v))} />
          <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeDasharray="6 5" />
          <Tooltip formatter={(v) => RM(Number(v))} labelStyle={{ color: "var(--foreground)" }} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--primary)"
            strokeWidth={2.5}
            isAnimationActive={!reduce}
            dot={(p) => {
              const { cx, cy, payload, index } = p as { cx: number; cy: number; payload: { value: number }; index: number };
              return <circle key={index} cx={cx} cy={cy} r={4} fill={payload.value < 0 ? "var(--danger)" : "var(--primary)"} stroke="var(--card)" strokeWidth={2} />;
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export type Slice = { name: string; value: number; color: string };

// A ring with the total in the middle. The list beside it (drawn by the page) carries the exact figures.
export function StatusDonut({ slices, total, caption }: { slices: Slice[]; total: number; caption: string }) {
  const reduce = useReducedMotion();
  const shown = slices.filter((x) => x.value > 0);
  return (
    <div role="img" aria-label={`${caption}: ${slices.map((x) => `${x.value} ${x.name}`).join(", ")}.`} className="relative size-[168px] shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={shown} dataKey="value" nameKey="name" innerRadius={56} outerRadius={80} paddingAngle={shown.length > 1 ? 2 : 0} stroke="var(--card)" strokeWidth={2} isAnimationActive={!reduce}>
            {shown.map((x) => (
              <Cell key={x.name} fill={x.color} />
            ))}
          </Pie>
          <Tooltip formatter={(v, n) => [`${v} items`, n]} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="font-display text-2xl leading-none font-bold tabular-nums">{total}</p>
          <p className="mt-1 text-xs text-muted-foreground">items</p>
        </div>
      </div>
    </div>
  );
}

// A small line with a soft fill and no axes, for the headline card. Drawn in the colour of the text on that card.
export function Sparkline({ points, label }: { points: { label: string; value: number }[]; label: string }) {
  const reduce = useReducedMotion();
  return (
    <div role="img" aria-label={label} className="h-24 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 6, right: 4, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity={0.35} />
              <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Tooltip formatter={(v) => RM(Number(v))} contentStyle={{ background: "var(--card)", color: "var(--foreground)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
          <Area type="monotone" dataKey="value" stroke="currentColor" strokeWidth={2} fill="url(#spark)" isAnimationActive={!reduce} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

type Pct = { actPct: number; idealPct: number };
// Share of sales spent on food, actual next to ideal, for today and the week.
export function FoodCostBars({ today, wtd }: { today: Pct; wtd?: Pct | null }) {
  const reduce = useReducedMotion();
  const data = [
    { name: "Today", actual: +today.actPct.toFixed(1), ideal: +today.idealPct.toFixed(1) },
    ...(wtd ? [{ name: "Week to date", actual: +wtd.actPct.toFixed(1), ideal: +wtd.idealPct.toFixed(1) }] : []),
  ];
  const desc = `Actual food cost ${today.actPct.toFixed(1)}% of sales today against an ideal of ${today.idealPct.toFixed(1)}%.`;
  return (
    <>
      <div role="img" aria-label={desc} className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 12, bottom: 0, left: 0 }} barGap={8}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="name" tick={axis} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
            <YAxis tick={axis} tickLine={false} axisLine={false} width={40} tickFormatter={(v) => `${v}%`} />
            <Tooltip formatter={(v) => `${v}%`} cursor={{ fill: "var(--muted)" }} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="actual" name="Actual %" maxBarSize={64} fill="var(--primary)" radius={[4, 4, 0, 0]} isAnimationActive={!reduce}>
              <LabelList dataKey="actual" position="top" formatter={(v) => `${Number(v).toFixed(0)}%`} style={{ fontSize: 12, fontWeight: 600, fill: "var(--foreground)" }} />
            </Bar>
            <Bar dataKey="ideal" name="Ideal %" maxBarSize={64} fill="var(--muted-foreground)" fillOpacity={0.45} radius={[4, 4, 0, 0]} isAnimationActive={!reduce}>
              <LabelList dataKey="ideal" position="top" formatter={(v) => `${Number(v).toFixed(0)}%`} style={{ fontSize: 12, fontWeight: 600, fill: "var(--foreground)" }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <i aria-hidden className="inline-block size-2.5 rounded-[3px] bg-primary" /> Actual
        </span>
        <span className="flex items-center gap-1.5">
          <i aria-hidden className="inline-block size-2.5 rounded-[3px] bg-muted-foreground/45" /> Ideal
        </span>
      </p>
    </>
  );
}
