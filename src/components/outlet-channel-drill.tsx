"use client";

import { ArrowLeft, ChevronRight, MousePointerClick } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChannelLogo } from "@/components/channel-parts";
import { fmtFull, fmtShort } from "@/components/drill-chart";
import { Seg } from "@/components/sales-ui";
import { Button } from "@/components/ui/button";
import { CHANNELS, outletChannelDays, outletChannelMonths } from "@/lib/channel-mock";
import type { Channel, ChannelKey, ChannelRow, ChannelSlice } from "@/lib/channel-mock";
import { MONTHS, YEAR } from "@/lib/overview-mock";
import type { Metric } from "@/lib/overview-mock";
import { cn } from "@/lib/utils";

const box = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 } as const;
const axis = { fontSize: 12, fill: "var(--muted-foreground)" } as const;

type Tab = ChannelKey | "all";
type Path = { outlet?: string; month?: number };

// Bars split by channel. Outlets are bars going right, months and days are columns. Select a bar to open the next level.
function StackBars({ data, keys, horizontal, metric, onPick, label }: { data: ChannelSlice[]; keys: Channel[]; horizontal: boolean; metric: Metric; onPick?: (id: string) => void; label: string }) {
  const rows = data.map((d) => ({ id: d.id, name: d.label, sub: d.sub, soft: !!d.soft, total: keys.reduce((s, c) => s + d.vals[c.key], 0), ...d.vals }));
  if (!rows.length) return <p className="py-10 text-center text-sm text-muted-foreground">Nothing to show for this choice.</p>;
  const pick = (d: unknown) => {
    const p = d as { payload?: { id: string }; id?: string };
    const id = p.payload?.id ?? p.id;
    if (onPick && id) onPick(id);
  };
  const tip = (
    <Tooltip
      cursor={{ fill: "var(--muted)" }}
      content={(p) => {
        const { active, payload } = p as unknown as { active?: boolean; payload?: { payload: (typeof rows)[number] }[] };
        const r = active && payload?.[0]?.payload;
        if (!r) return null;
        return (
          <div style={box} className="min-w-52 px-3 py-2.5 shadow-sm">
            <p className="mb-1.5 font-semibold">
              {r.name}
              {r.sub ? <span className="ml-1.5 font-normal text-muted-foreground">{r.sub}</span> : null}
            </p>
            {[...keys].reverse().map((c) => (
              <p key={c.key} className="flex items-center justify-between gap-6 tabular-nums">
                <span className="flex items-center gap-2">
                  <i aria-hidden className="size-2.5 rounded-[3px]" style={{ background: c.color }} />
                  <ChannelLogo channel={c} size="chip" />
                </span>
                <span>
                  {fmtFull(metric, r[c.key])} <span className="text-muted-foreground">{r.total ? Math.round((r[c.key] / r.total) * 100) : 0}%</span>
                </span>
              </p>
            ))}
            <p className="mt-1.5 flex justify-between border-t pt-1.5 font-semibold tabular-nums">
              <span>Total</span>
              {fmtFull(metric, r.total)}
            </p>
            {onPick ? <p className="mt-1.5 text-primary">Click to open</p> : null}
          </div>
        );
      }}
    />
  );
  const bars = keys.map((c, i) => (
    <Bar key={c.key} dataKey={c.key} stackId="s" fill={c.color} radius={i === keys.length - 1 ? (horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]) : 0} isAnimationActive={false} cursor={onPick ? "pointer" : "default"} onClick={pick} maxBarSize={horizontal ? 22 : 48}>
      {rows.map((r) => (
        <Cell key={r.id} fill={c.color} fillOpacity={r.soft ? 0.55 : 1} />
      ))}
      {i === keys.length - 1 && (horizontal || rows.length <= 12) ? (
        <LabelList dataKey="total" position={horizontal ? "right" : "top"} formatter={(v) => (horizontal ? fmtFull(metric, Number(v)) : fmtShort(metric, Number(v)))} style={{ fontSize: 12, fontWeight: 600, fill: "var(--foreground)" }} />
      ) : null}
    </Bar>
  ));

  if (horizontal) {
    return (
      <div role="img" aria-label={label} style={{ height: rows.length * 34 + 16 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 2, right: 96, bottom: 2, left: 0 }} barCategoryGap={8}>
            <CartesianGrid horizontal={false} stroke="var(--border)" />
            <XAxis type="number" hide domain={[0, "dataMax"]} />
            <YAxis type="category" dataKey="name" width={150} tickLine={false} axisLine={false} interval={0} tick={{ ...axis, fill: "var(--foreground)" }} tickFormatter={(v: string) => (v.length > 21 ? v.slice(0, 20) + "…" : v)} />
            {tip}
            {bars}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }
  return (
    <div role="img" aria-label={label} className="h-[340px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 24, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="name" tick={axis} tickLine={false} axisLine={{ stroke: "var(--border)" }} interval={rows.length > 16 ? 1 : 0} />
          <YAxis tick={axis} tickLine={false} axisLine={false} width={52} tickFormatter={(v) => fmtShort(metric, Number(v)).replace("RM ", "")} />
          {tip}
          {bars}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Best outlets for each channel, as a chart you can open (the idea of a Tableau dashboard: choose a channel to filter,
// click a bar to drill). Pick a channel at the top, or All to see every channel stacked. Click an outlet to see its
// months, and a month to see its days.
export function OutletChannelDrill({ rows, channels, metric, measureLabel, periodLabel }: { rows: ChannelRow[]; channels: Channel[]; metric: Metric; measureLabel: string; periodLabel: string }) {
  const [tab, setTab] = useState<Tab>("all");
  const [end, setEnd] = useState<"top" | "bottom">("top");
  const [path, setPath] = useState<Path>({});

  const active: Tab = tab !== "all" && channels.some((c) => c.key === tab) ? tab : "all";
  const keys = active === "all" ? channels : channels.filter((c) => c.key === active);
  const ch = active === "all" ? null : CHANNELS.find((c) => c.key === active)!;
  const level = path.month !== undefined ? "days" : path.outlet ? "months" : "outlets";

  const data: ChannelSlice[] = useMemo(() => {
    if (level === "days") return outletChannelDays(path.outlet!, path.month!, metric);
    if (level === "months") return outletChannelMonths(path.outlet!, metric);
    const val = (r: ChannelRow) => keys.reduce((s, c) => s + r.vals[c.key], 0);
    const sorted = [...rows].sort((a, b) => val(b) - val(a));
    const ten = end === "top" ? sorted.slice(0, 10) : sorted.slice(-10).reverse();
    return ten.map((r) => ({ id: r.name, label: r.name, sub: r.area, vals: r.vals }));
  }, [level, path, metric, rows, keys, end]);

  const pick = (id: string) => {
    if (level === "outlets") setPath({ outlet: id });
    else if (level === "months") setPath((p) => ({ ...p, month: +id }));
  };
  const up = () => setPath((p) => (p.month !== undefined ? { outlet: p.outlet } : {}));
  const crumbs = [{ label: "All outlets", d: 0 }, ...(path.outlet ? [{ label: path.outlet, d: 1 }] : []), ...(path.month !== undefined ? [{ label: `${MONTHS[path.month]} ${YEAR}`, d: 2 }] : [])];
  const goTo = (d: number) => setPath((p) => (d === 0 ? {} : d === 1 ? { outlet: p.outlet } : p));
  const who = ch ? ch.label : "each channel";
  const title = level === "outlets" ? `${end === "top" ? "Best" : "Weakest"} outlets for ${who}` : level === "months" ? `${path.outlet}: ${measureLabel.toLowerCase()} by month and channel` : `${path.outlet}, ${MONTHS[path.month!]} ${YEAR}: by day and channel`;
  const hint = level === "outlets" ? `${periodLabel}. Click an outlet to see its months.` : level === "months" ? "Click a month to see its days." : "Last level. Weekends are stronger, weekdays softer.";

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {level !== "days" ? <MousePointerClick aria-hidden className="size-3.5" /> : null}
            {hint}
          </p>
        </div>
        {level === "outlets" ? <Seg<"top" | "bottom"> label="Which outlets" value={end} onChange={setEnd} options={[{ value: "top", label: "Top 10" }, { value: "bottom", label: "Bottom 10" }]} /> : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="radiogroup" aria-label="Channel" className="flex flex-wrap items-center gap-1.5">
          {[{ key: "all" as Tab, label: "All channels", c: null as Channel | null }, ...channels.map((c) => ({ key: c.key as Tab, label: c.label, c }))].map((o) => {
            const on = active === o.key;
            return (
              <button
                key={o.key}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={o.label}
                onClick={() => setTab(o.key)}
                className={cn("inline-flex min-h-8 items-center rounded-full border px-3 py-1 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring", on ? "border-foreground/30 bg-card text-foreground shadow-sm" : "text-muted-foreground opacity-70 hover:opacity-100")}
              >
                {o.c ? <ChannelLogo channel={o.c} size="chip" /> : o.label}
              </button>
            );
          })}
        </div>
        {path.outlet ? (
          <nav aria-label="Drill-down path" className="flex flex-wrap items-center gap-1.5 text-sm">
            <Button variant="outline" size="sm" onClick={up} aria-label="Back one level">
              <ArrowLeft aria-hidden /> Back
            </Button>
            <ol className="flex flex-wrap items-center gap-1.5">
              {crumbs.map((c, i) => (
                <li key={c.d} className="inline-flex items-center gap-1.5">
                  {i > 0 ? <ChevronRight aria-hidden className="size-3.5 text-muted-foreground" /> : null}
                  {i === crumbs.length - 1 ? (
                    <span aria-current="page" className="font-semibold">{c.label}</span>
                  ) : (
                    <button type="button" onClick={() => goTo(c.d)} className="rounded text-muted-foreground outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                      {c.label}
                    </button>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        ) : null}
      </div>

      <StackBars data={data} keys={keys} horizontal={level === "outlets"} metric={metric} onPick={level === "days" ? undefined : pick} label={title} />
      <p className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        {keys.map((c) => (
          <span key={c.key} className="flex items-center gap-1.5">
            <i aria-hidden className="inline-block size-2.5 rounded-[3px]" style={{ background: c.color }} />
            <ChannelLogo channel={c} size="chip" />
          </span>
        ))}
        {level !== "outlets" ? <span className="flex items-center gap-1.5"><i aria-hidden className="inline-block size-2.5 rounded-[3px] bg-foreground/55" /> {level === "months" ? "Month so far is softer" : "Weekdays are softer"}</span> : null}
      </p>
    </div>
  );
}
