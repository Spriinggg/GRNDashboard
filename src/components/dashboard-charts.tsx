"use client";

import { useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { cn } from "@/lib/utils";

// The small interactive charts of the Dashboard. Point at a mark to read it, click a mark to open the page behind it
// (`onOpen`). Every chart has a text description for screen readers. Colours follow DESIGN.md: brand red for the one mark
// that matters, grey for the rest, status colours only for a status.
const axis = { fontSize: 11, fill: "var(--muted-foreground)" } as const;
const box = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 } as const;
const line = (k: string, v: React.ReactNode) => (
  <p key={k} className="flex justify-between gap-6 tabular-nums">
    <span className="text-muted-foreground">{k}</span>
    <b className="font-semibold">{v}</b>
  </p>
);
export const compact = (v: number) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1)}m` : Math.abs(v) >= 1e3 ? `${Math.round(v / 1e3)}k` : String(Math.round(v)));
const rm = (v: number) => `RM ${Math.round(v).toLocaleString("en")}`;

// Net sales for each day as an area. Point at a day for its figure. Click to open the Sales page.
export function SalesArea({ data, label, onOpen }: { data: { label: string; value: number }[]; label: string; onOpen: () => void }) {
  const reduce = useReducedMotion();
  return (
    <div role="img" aria-label={label} className="h-[230px] cursor-pointer">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 6, bottom: 0, left: 0 }} onClick={onOpen}>
          <defs>
            <linearGradient id="dash-sales" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={{ stroke: "var(--border)" }} interval={data.length > 8 ? Math.ceil(data.length / 6) - 1 : 0} />
          <YAxis tick={axis} tickLine={false} axisLine={false} width={44} tickFormatter={(v) => compact(Number(v))} domain={[0, "dataMax"]} />
          <Tooltip
            cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
            content={(p) => {
              const { active, payload } = p as unknown as { active?: boolean; payload?: { payload: { label: string; value: number } }[] };
              const d = active && payload?.[0]?.payload;
              if (!d) return null;
              return (
                <div style={box} className="min-w-44 px-3 py-2.5 shadow-sm">
                  <p className="mb-1 font-semibold">{d.label}</p>
                  {line("Net sales", rm(d.value))}
                  <p className="mt-1.5 text-primary">Click to open Sales</p>
                </div>
              );
            }}
          />
          <Area type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2} fill="url(#dash-sales)" isAnimationActive={!reduce} activeDot={{ r: 4, fill: "var(--primary)", stroke: "var(--card)", strokeWidth: 2 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export type RingSlice = { key: string; label: string; value: number; color: string; node?: React.ReactNode };

// A ring with a list beside it. Point at a slice or a name in the list and the middle shows that part. Details never float
// over the ring. Click a slice or a name to open the page. Use it only for a few parts that add up to a whole.
export function Ring({ slices, unit, label, onOpen, total, fmt = (v) => v.toLocaleString("en") }: { slices: RingSlice[]; unit: string; label: string; onOpen: () => void; total?: string; fmt?: (v: number) => string }) {
  const reduce = useReducedMotion();
  const [at, setAt] = useState<string | null>(null);
  const sum = slices.reduce((s, x) => s + x.value, 0) || 1;
  const on = slices.find((s) => s.key === at);
  const shown = slices.filter((s) => s.value > 0);
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3" onMouseLeave={() => setAt(null)}>
      <div role="img" aria-label={label} className="relative size-[150px] shrink-0 cursor-pointer">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={shown} dataKey="value" nameKey="label" innerRadius={50} outerRadius={72} paddingAngle={shown.length > 1 ? 2 : 0} stroke="var(--card)" strokeWidth={2} isAnimationActive={!reduce} onClick={onOpen} onMouseEnter={(_, i) => setAt(shown[i]?.key ?? null)}>
              {shown.map((s) => (
                <Cell key={s.key} fill={s.color} fillOpacity={at && at !== s.key ? 0.35 : 1} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="font-display text-xl leading-none font-bold tabular-nums">{on ? `${Math.round((on.value / sum) * 100)}%` : total ?? slices.reduce((s, x) => s + x.value, 0)}</p>
            <p className="mt-1 max-w-20 truncate text-xs text-muted-foreground">{on ? on.label : unit}</p>
          </div>
        </div>
      </div>
      <ul className="flex min-w-40 flex-1 flex-col gap-1" aria-label={label}>
        {slices.map((s) => (
          <li key={s.key}>
            <button
              type="button"
              onClick={onOpen}
              onMouseEnter={() => setAt(s.key)}
              onFocus={() => setAt(s.key)}
              onBlur={() => setAt(null)}
              className={cn("-mx-1.5 flex w-[calc(100%+0.75rem)] items-center justify-between gap-3 rounded-md px-1.5 py-1 text-left text-sm outline-none transition-opacity hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring", at && at !== s.key && "opacity-50")}
            >
              <span className="flex min-w-0 items-center gap-2">
                <i aria-hidden className="size-2.5 shrink-0 rounded-[3px]" style={{ background: s.color }} />
                <span className="min-w-0 truncate">{s.node ?? s.label}</span>
              </span>
              <span className="shrink-0 font-medium tabular-nums">
                {fmt(s.value)} <span className="text-muted-foreground">{Math.round((s.value / sum) * 100)}%</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export type HRow = { key: string; label: string; value: number; text: string; color?: string; tip?: [string, string][] };

// Horizontal bars with the figure at the end and an optional dashed target. Point at a bar for details and click to open.
export function HBars({ rows, domain, target, label, onOpen, hint }: { rows: HRow[]; domain: number; target?: { value: number; text: string }; label: string; onOpen: () => void; hint: string }) {
  const reduce = useReducedMotion();
  if (!rows.length) return <p className="py-8 text-center text-sm text-muted-foreground">Nothing to show for these filters.</p>;
  return (
    <div role="img" aria-label={label} className="cursor-pointer" style={{ height: rows.length * 34 + (target ? 30 : 12) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: target ? 18 : 2, right: 64, bottom: 0, left: 0 }} barCategoryGap={8} onClick={onOpen}>
          <CartesianGrid horizontal={false} stroke="var(--border)" />
          <XAxis type="number" hide domain={[0, domain]} />
          <YAxis type="category" dataKey="label" width={118} tickLine={false} axisLine={false} interval={0} tick={{ ...axis, fontSize: 12, fill: "var(--foreground)" }} tickFormatter={(v: string) => (v.length > 17 ? v.slice(0, 16) + "…" : v)} />
          {target ? <ReferenceLine x={target.value} stroke="var(--muted-foreground)" strokeDasharray="6 5" label={{ value: target.text, position: "top", fill: "var(--muted-foreground)", fontSize: 11 }} /> : null}
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            content={(p) => {
              const { active, payload } = p as unknown as { active?: boolean; payload?: { payload: HRow }[] };
              const r = active && payload?.[0]?.payload;
              if (!r) return null;
              return (
                <div style={box} className="min-w-44 px-3 py-2.5 shadow-sm">
                  <p className="mb-1 font-semibold">{r.label}</p>
                  {(r.tip ?? [["Figure", r.text]]).map(([k, v]) => line(k, v))}
                  <p className="mt-1.5 text-primary">{hint}</p>
                </div>
              );
            }}
          />
          <Bar dataKey="value" radius={4} maxBarSize={20} isAnimationActive={!reduce}>
            {rows.map((r) => (
              <Cell key={r.key} fill={r.color ?? "var(--muted-foreground)"} fillOpacity={r.color ? 0.9 : 0.6} />
            ))}
            <LabelList dataKey="text" position="right" style={{ fontSize: 12, fontWeight: 600, fill: "var(--foreground)" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export type WaterRow = { name: string; range: [number, number]; text: string; share: number; color: string };

// Net sales down to gross profit: sales, then what the platforms take, then the cost of food, then what is left.
export function Waterfall({ rows, label, onOpen }: { rows: WaterRow[]; label: string; onOpen: () => void }) {
  const reduce = useReducedMotion();
  return (
    <div role="img" aria-label={label} className="h-[210px] cursor-pointer">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 22, right: 4, bottom: 0, left: 0 }} onClick={onOpen}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="name" tick={axis} tickLine={false} axisLine={{ stroke: "var(--border)" }} interval={0} />
          <YAxis tick={axis} tickLine={false} axisLine={false} width={40} tickFormatter={(v) => compact(Number(v))} />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            content={(p) => {
              const { active, payload } = p as unknown as { active?: boolean; payload?: { payload: WaterRow }[] };
              const r = active && payload?.[0]?.payload;
              if (!r) return null;
              return (
                <div style={box} className="min-w-44 px-3 py-2.5 shadow-sm">
                  <p className="mb-1 font-semibold">{r.name}</p>
                  {line("Amount", r.text)}
                  {line("Share of net sales", `${r.share.toFixed(1)}%`)}
                  <p className="mt-1.5 text-primary">Click to open Profit &amp; loss</p>
                </div>
              );
            }}
          />
          <Bar dataKey="range" radius={3} maxBarSize={46} isAnimationActive={!reduce}>
            {rows.map((r) => (
              <Cell key={r.name} fill={r.color} fillOpacity={r.color === "var(--primary)" ? 0.95 : 0.55} />
            ))}
            <LabelList dataKey="text" position="top" style={{ fontSize: 11, fontWeight: 600, fill: "var(--foreground)" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// A line of a share each day against its target. Point at a day to read it.
export function TargetLine({ data, target, label, onOpen, name }: { data: { label: string; pct: number }[]; target: number; label: string; onOpen: () => void; name: string }) {
  const reduce = useReducedMotion();
  const lo = Math.floor(Math.min(...data.map((d) => d.pct), target) - 3);
  const hi = Math.ceil(Math.max(...data.map((d) => d.pct), target) + 3);
  return (
    <div role="img" aria-label={label} className="h-[170px] cursor-pointer">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 6, bottom: 0, left: 0 }} onClick={onOpen}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={{ stroke: "var(--border)" }} interval={data.length > 8 ? Math.ceil(data.length / 6) - 1 : 0} />
          <YAxis tick={axis} tickLine={false} axisLine={false} width={36} domain={[lo, hi]} tickFormatter={(v) => `${v}%`} />
          <ReferenceLine y={target} stroke="var(--muted-foreground)" strokeDasharray="6 5" />
          <Tooltip
            cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
            content={(p) => {
              const { active, payload } = p as unknown as { active?: boolean; payload?: { payload: { label: string; pct: number } }[] };
              const d = active && payload?.[0]?.payload;
              if (!d) return null;
              return (
                <div style={box} className="min-w-40 px-3 py-2.5 shadow-sm">
                  <p className="mb-1 font-semibold">{d.label}</p>
                  {line(name, `${d.pct.toFixed(1)}%`)}
                  {line("Target", `${target}%`)}
                </div>
              );
            }}
          />
          <Line type="monotone" dataKey="pct" stroke="var(--primary)" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "var(--primary)", stroke: "var(--card)", strokeWidth: 2 }} isAnimationActive={!reduce} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
