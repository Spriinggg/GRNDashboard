"use client";

import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, LabelList, Line, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import { ChannelLogo } from "@/components/channel-parts";
import { fmtDelta, fmtFull, fmtShort } from "@/components/drill-chart";
import { FEE_PARTS } from "@/components/fee-breakdown";
import { RM } from "@/lib/calc";
import { CHANNELS } from "@/lib/channel-mock";
import { BASIS_LABEL, costOf, grossOf, marginOf } from "@/lib/pnl-mock";
import type { Basis, Pnl, PnlTrendPoint } from "@/lib/pnl-mock";
import { cn } from "@/lib/utils";

const axis = { fontSize: 12, fill: "var(--muted-foreground)" } as const;
const box = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 } as const;
// Axis and bar labels without the currency: 4.67M, 643k, 6.2k.
const rmk = (v: number) => (Math.abs(v) >= 1_000_000 ? `${(v / 1_000_000).toFixed(2)}M` : fmtShort("sales", v).replace("RM ", ""));
const pc = (v: number, of: number) => (of ? `${((v / of) * 100).toFixed(1)}%` : "0%");

// ---- Waterfall -------------------------------------------------------------------------------------------------------
export type WStep = { name: string; amount: number; kind: "start" | "less" | "end"; fill: string; opacity: number };
type Bar = { name: string; base: number; value: number; text: string; fill: string; opacity: number; amount: number; start: number; kind: WStep["kind"] };

// From the first figure down through each deduction to what is left. The first step is the 100% the others are read against.
export function Waterfall({ steps, label }: { steps: WStep[]; label: string }) {
  const start = steps[0]?.amount ?? 0;
  let run = 0;
  const data: Bar[] = steps.map((s) => {
    let base = 0;
    if (s.kind === "start") run = s.amount;
    else if (s.kind === "less") {
      run -= s.amount;
      base = run;
    }
    return { name: s.name, base, value: s.amount, text: (s.kind === "less" ? "−" : "") + rmk(s.amount), fill: s.fill, opacity: s.opacity, amount: s.amount, start, kind: s.kind };
  });
  return (
    <div role="img" aria-label={label} className="h-[340px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 24, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="name" tick={axis} tickLine={false} axisLine={{ stroke: "var(--border)" }} interval={0} />
          <YAxis tick={axis} tickLine={false} axisLine={false} width={52} tickFormatter={(v) => rmk(Number(v))} />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            content={(p) => {
              const { active, payload } = p as unknown as { active?: boolean; payload?: { payload: Bar }[] };
              const b = active && payload?.[0]?.payload;
              if (!b) return null;
              return (
                <div style={box} className="min-w-48 px-3 py-2.5 shadow-sm">
                  <p className="mb-1 font-semibold">{b.name}</p>
                  <p className="flex justify-between gap-6 tabular-nums"><span className="text-muted-foreground">Amount</span><b className="font-semibold">{b.kind === "less" ? "−" : ""}{fmtFull("sales", b.amount)}</b></p>
                  <p className="flex justify-between gap-6 tabular-nums"><span className="text-muted-foreground">Of net sales</span><b className="font-semibold">{pc(b.amount, b.start)}</b></p>
                </div>
              );
            }}
          />
          <Bar dataKey="base" stackId="w" fill="transparent" isAnimationActive={false} />
          <Bar dataKey="value" stackId="w" radius={4} maxBarSize={80} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.name} fill={d.fill} fillOpacity={d.opacity} />
            ))}
            <LabelList dataKey="text" position="top" style={{ fontSize: 12, fontWeight: 600, fill: "var(--foreground)" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---- Statement -------------------------------------------------------------------------------------------------------
type Line = { key: string; label: React.ReactNode; v: number | null; prev: number | null; kind?: "main" | "sub" | "total" | "planned"; watch?: boolean; open?: string };

// The profit and loss statement, one column of lines. Net sales, platform fees and the cost of food open to show what
// they are made of. The lines for labour, rent and other costs are there but marked Planned, so nobody reads a missing
// cost as a zero cost.
export function PnlStatement({ p, prev, basis }: { p: Pnl; prev: Pnl | null; basis: Basis }) {
  const [open, setOpen] = useState<Record<string, boolean>>({ sales: false, fees: false, cost: false });
  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));
  const net = p.sales - p.fees.total;
  const prevNet = prev ? prev.sales - prev.fees.total : null;
  const other: Basis = basis === "grn" ? "used" : "grn";

  const lines: Line[] = [
    { key: "sales", label: "Net sales", v: p.sales, prev: prev?.sales ?? null, kind: "main", watch: true, open: "sales" },
    ...(open.sales ? CHANNELS.map((c): Line => ({ key: "s-" + c.key, label: <ChannelLogo channel={c} size="chip" />, v: p.byChannel[c.key], prev: prev ? prev.byChannel[c.key] : null, kind: "sub" })) : []),
    { key: "fees", label: "Less: platform fees", v: -p.fees.total, prev: prev ? -prev.fees.total : null, kind: "main", open: "fees" },
    ...(open.fees
      ? FEE_PARTS.filter((f) => p.fees[f.key] > 0.5).map((f): Line => ({
          key: "f-" + f.key,
          label: (
            <span className="flex items-center gap-2">
              <i aria-hidden className="inline-block size-2.5 shrink-0 rounded-[3px]" style={{ background: f.color, opacity: f.opacity }} />
              {f.label}
            </span>
          ),
          v: -p.fees[f.key],
          prev: prev ? -prev.fees[f.key] : null,
          kind: "sub",
        }))
      : []),
    { key: "net", label: "Net revenue after fees", v: net, prev: prevNet, kind: "total", watch: true },
    { key: "cost", label: `Less: cost of food (${basis === "grn" ? "GRN purchases" : "food used"})`, v: -costOf(p, basis), prev: prev ? -costOf(prev, basis) : null, kind: "main", open: "cost" },
    ...(open.cost
      ? ([basis, other] as Basis[]).map((b): Line => ({
          key: "c-" + b,
          label: (
            <span>
              {BASIS_LABEL[b]}
              {b === basis ? <span className="ml-2 text-xs text-muted-foreground">used above</span> : <span className="ml-2 text-xs text-muted-foreground">for comparison</span>}
            </span>
          ),
          v: -costOf(p, b),
          prev: prev ? -costOf(prev, b) : null,
          kind: "sub",
        }))
      : []),
    { key: "gp", label: "Gross profit", v: grossOf(p, basis), prev: prev ? grossOf(prev, basis) : null, kind: "total", watch: true },
    { key: "labour", label: "Labour cost", v: null, prev: null, kind: "planned" },
    { key: "rent", label: "Rent and utilities", v: null, prev: null, kind: "planned" },
    { key: "other", label: "Other overheads", v: null, prev: null, kind: "planned" },
    { key: "op", label: "Operating profit", v: null, prev: null, kind: "planned" },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] border-collapse text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground">
            <th scope="col" className="pb-2 text-left font-normal">Line</th>
            <th scope="col" className="pb-2 text-right font-normal">RM</th>
            <th scope="col" className="pb-2 text-right font-normal">Of net sales</th>
            <th scope="col" className="pb-2 text-right font-normal">Against before</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {lines.map((l) => {
            const planned = l.kind === "planned";
            // Change in the size of the line: a fee that grew shows as up, whatever its sign in the statement.
            const d = l.v !== null && l.prev ? (Math.abs(l.v) - Math.abs(l.prev)) / Math.abs(l.prev) : null;
            return (
              <tr key={l.key} className={cn(l.kind === "total" && "border-t font-semibold", l.kind === "main" && "border-t", planned && "border-t text-muted-foreground")}>
                <th scope="row" className={cn("py-2 pr-2 text-left font-normal", l.kind === "main" && "font-medium", l.kind === "total" && "font-semibold", l.kind === "sub" && "pl-6")}>
                  {l.open ? (
                    <button type="button" aria-expanded={!!open[l.open]} onClick={() => toggle(l.open!)} className="-ml-1 inline-flex items-center gap-1.5 rounded px-1 text-left font-medium outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
                      <ChevronRight aria-hidden className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open[l.open] && "rotate-90")} />
                      {l.label}
                    </button>
                  ) : (
                    l.label
                  )}
                </th>
                <td className="py-2 text-right whitespace-nowrap">{planned ? <span className="text-xs">Planned</span> : RM(l.v ?? 0)}</td>
                <td className="py-2 pl-3 text-right whitespace-nowrap text-muted-foreground">{planned || l.v === null ? "–" : pc(Math.abs(l.v), p.sales)}</td>
                <td className={cn("py-2 pl-3 text-right whitespace-nowrap", d !== null && l.watch && d < 0 ? "font-medium text-danger" : "text-muted-foreground")}>{d === null ? "–" : fmtDelta(d)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted-foreground">Margin {(marginOf(p, basis) * 100).toFixed(1)}% of net sales. Labour, rent and other costs are Planned: their reports are not added yet, so gross profit is not yet a full profit.</p>
    </div>
  );
}

// ---- Trend -----------------------------------------------------------------------------------------------------------
// Gross profit a day as columns and the margin as a line, month by month.
export function PnlTrend({ data, label }: { data: PnlTrendPoint[]; label: string }) {
  const ms = data.map((d) => d.margin);
  const lo = Math.floor(Math.min(...ms, 100) - 2);
  const hi = Math.ceil(Math.max(...ms, 0) + 2);
  return (
    <div role="img" aria-label={label} className="h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
          <YAxis yAxisId="rm" tick={axis} tickLine={false} axisLine={false} width={52} tickFormatter={(v) => rmk(Number(v))} />
          <YAxis yAxisId="pct" orientation="right" domain={[lo, hi]} tick={axis} tickLine={false} axisLine={false} width={44} tickFormatter={(v) => `${v}%`} />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            content={(p) => {
              const { active, payload } = p as unknown as { active?: boolean; payload?: { payload: PnlTrendPoint }[] };
              const d = active && payload?.[0]?.payload;
              if (!d) return null;
              return (
                <div style={box} className="min-w-52 px-3 py-2.5 shadow-sm">
                  <p className="mb-1 font-semibold">{d.label} <span className="font-normal text-muted-foreground">· a day, average</span></p>
                  <p className="flex justify-between gap-6 tabular-nums"><span className="text-muted-foreground">Net sales</span><b className="font-semibold">{fmtFull("sales", d.sales)}</b></p>
                  <p className="flex justify-between gap-6 tabular-nums"><span className="text-muted-foreground">Gross profit</span><b className="font-semibold">{fmtFull("sales", d.gp)}</b></p>
                  <p className="flex justify-between gap-6 tabular-nums"><span className="text-muted-foreground">Margin</span><b className="font-semibold">{d.margin.toFixed(1)}%</b></p>
                </div>
              );
            }}
          />
          <Bar yAxisId="rm" dataKey="gp" fill="var(--primary)" fillOpacity={0.85} radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive={false} />
          <Line yAxisId="pct" type="monotone" dataKey="margin" stroke="var(--foreground)" strokeWidth={2} dot={{ r: 3, fill: "var(--foreground)" }} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---- Purchases against food used -------------------------------------------------------------------------------------
// What was received on the GRN next to what was used. Where purchases are higher, stock built up on the shelf.
export function PurchasesVsUsed({ data, label }: { data: PnlTrendPoint[]; label: string }) {
  return (
    <div role="img" aria-label={label} className="h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
          <YAxis tick={axis} tickLine={false} axisLine={false} width={52} tickFormatter={(v) => rmk(Number(v))} />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            content={(p) => {
              const { active, payload } = p as unknown as { active?: boolean; payload?: { payload: PnlTrendPoint }[] };
              const d = active && payload?.[0]?.payload;
              if (!d) return null;
              const gap = d.grn - d.used;
              return (
                <div style={box} className="min-w-52 px-3 py-2.5 shadow-sm">
                  <p className="mb-1 font-semibold">{d.label} <span className="font-normal text-muted-foreground">· a day, average</span></p>
                  <p className="flex justify-between gap-6 tabular-nums"><span className="text-muted-foreground">Purchases (GRN)</span><b className="font-semibold">{fmtFull("sales", d.grn)}</b></p>
                  <p className="flex justify-between gap-6 tabular-nums"><span className="text-muted-foreground">Food used</span><b className="font-semibold">{fmtFull("sales", d.used)}</b></p>
                  <p className="mt-1.5 border-t pt-1.5 tabular-nums">{gap >= 0 ? `Stock built up by ${fmtFull("sales", gap)} a day` : `Stock run down by ${fmtFull("sales", -gap)} a day`}</p>
                </div>
              );
            }}
          />
          <Bar dataKey="grn" fill="var(--muted-foreground)" fillOpacity={0.55} radius={[4, 4, 0, 0]} maxBarSize={26} isAnimationActive={false} />
          <Bar dataKey="used" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={26} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---- Outlet scatter --------------------------------------------------------------------------------------------------
export type Dot = { name: string; area: string; sales: number; margin: number; gp: number; flag: boolean };

// Every outlet as a dot: net sales across, margin up. A dashed line is the margin of the whole network. Dots below it
// and to the right are big outlets that keep less of each ringgit. Click a dot to open that outlet.
export function OutletScatter({ dots, network, onPick, label }: { dots: Dot[]; network: number; onPick: (name: string) => void; label: string }) {
  return (
    <div role="img" aria-label={label} className="h-[360px]">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 12, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid stroke="var(--border)" />
          <XAxis type="number" dataKey="sales" name="Net sales" tick={axis} tickLine={false} axisLine={{ stroke: "var(--border)" }} tickFormatter={(v) => rmk(Number(v))} domain={["dataMin - 5000", "dataMax + 5000"]} />
          <YAxis type="number" dataKey="margin" name="Margin" tick={axis} tickLine={false} axisLine={false} width={44} tickFormatter={(v) => `${Number(v).toFixed(0)}%`} domain={["dataMin - 1", "dataMax + 1"]} />
          <ReferenceLine y={network} stroke="var(--muted-foreground)" strokeDasharray="6 5" />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            content={(p) => {
              const { active, payload } = p as unknown as { active?: boolean; payload?: { payload: Dot }[] };
              const d = active && payload?.[0]?.payload;
              if (!d) return null;
              return (
                <div style={box} className="min-w-52 px-3 py-2.5 shadow-sm">
                  <p className="font-semibold">{d.name}</p>
                  <p className="mb-1 text-muted-foreground">{d.area}</p>
                  <p className="flex justify-between gap-6 tabular-nums"><span className="text-muted-foreground">Net sales</span><b className="font-semibold">{fmtFull("sales", d.sales)}</b></p>
                  <p className="flex justify-between gap-6 tabular-nums"><span className="text-muted-foreground">Gross profit</span><b className="font-semibold">{fmtFull("sales", d.gp)}</b></p>
                  <p className="flex justify-between gap-6 tabular-nums"><span className="text-muted-foreground">Margin</span><b className="font-semibold">{d.margin.toFixed(1)}% <span className="font-normal text-muted-foreground">network {network.toFixed(1)}%</span></b></p>
                  <p className="mt-1.5 text-primary">Click to open</p>
                </div>
              );
            }}
          />
          <Scatter data={dots} isAnimationActive={false} cursor="pointer" onClick={(d) => onPick(((d as unknown as { payload?: Dot; name?: string }).payload?.name ?? (d as unknown as Dot).name) as string)}>
            {dots.map((d) => (
              <Cell key={d.name} fill={d.flag ? "var(--primary)" : "var(--muted-foreground)"} fillOpacity={d.flag ? 0.95 : 0.55} stroke="var(--card)" />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
