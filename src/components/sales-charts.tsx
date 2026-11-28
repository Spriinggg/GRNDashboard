"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChannelLogo } from "@/components/channel-parts";
import { fmtFull, fmtShort } from "@/components/drill-chart";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import type { ChannelKey, ChannelTrendPoint } from "@/lib/channel-mock";
import { CHANNELS } from "@/lib/channel-mock";
import type { Metric, TrendPoint } from "@/lib/overview-mock";

const axis = { fontSize: 12, fill: "var(--muted-foreground)" } as const;
const box = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 } as const;
const yTick = (m: Metric) => (v: number) => fmtShort(m, Number(v)).replace("RM ", "");

// Ten lines in ten colours is hard on the eye, so the Top 10 uses two: the leader and the outlet being pointed at are
// brand red, the rest are grey. The names are in the tooltip and in the list beside the chart.
export const LINE_LEAD = "var(--primary)";
export const LINE_REST = "var(--muted-foreground)";

// Average daily sales through the year. Either one line per outlet (the Top 10) or one line for the total.
export function TrendLines({ data, keys, mode, hot, metric, label }: { data: TrendPoint[]; keys: { key: string; color: string }[]; mode: "top" | "total"; hot: string | null; metric: Metric; label: string }) {
  const reduce = useReducedMotion();
  const lines = mode === "total" ? [{ key: "total", color: "var(--primary)" }] : keys;
  return (
    <div role="img" aria-label={label} className="h-[340px] lg:h-[430px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
          <YAxis tick={axis} tickLine={false} axisLine={false} width={52} tickFormatter={yTick(metric)} />
          <Tooltip
            content={(p) => {
              const { active, payload, label: l } = p as unknown as { active?: boolean; payload?: { dataKey: string; value: number; color: string }[]; label?: string };
              if (!active || !payload?.length) return null;
              const rows = payload.filter((x) => x.value != null).sort((a, b) => b.value - a.value);
              return (
                <div style={box} className="px-3 py-2 shadow-sm">
                  <p className="mb-1 font-semibold">{l} · per day</p>
                  {rows.map((r) => (
                    <p key={r.dataKey} className="flex items-center justify-between gap-4 tabular-nums">
                      <span className="flex items-center gap-1.5">
                        <i aria-hidden className="size-2 rounded-full" style={{ background: r.color }} />
                        {r.dataKey === "total" ? "All selected outlets" : r.dataKey}
                      </span>
                      {fmtFull(metric, r.value)}
                    </p>
                  ))}
                </div>
              );
            }}
          />
          {lines.map((l) => {
            const on = hot === l.key;
            const dim = mode === "top" && hot && !on;
            const rest = mode === "top" && l.color === LINE_REST;
            return <Line key={l.key} type="monotone" dataKey={l.key} stroke={on ? LINE_LEAD : l.color} strokeWidth={on ? 3.5 : mode === "total" ? 3 : 2} strokeOpacity={dim ? 0.15 : rest ? 0.55 : 1} dot={false} activeDot={{ r: 4 }} isAnimationActive={!reduce} connectNulls={false} />;
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// Sales per day, stacked by channel. The year view has a bar for each month, the month view a bar for each day. Select a bar
// in the year view to open that month. The tooltip names each channel with its logo.
export function ChannelStack({ data, keys, focus, metric, label, unit, onPick }: { data: ChannelTrendPoint[]; keys: ChannelKey[]; focus: ChannelKey | null; metric: Metric; label: string; unit: string; onPick?: (id: string) => void }) {
  const reduce = useReducedMotion();
  const pick = (d: unknown) => {
    const p = d as { payload?: { id: string }; id?: string };
    const id = p.payload?.id ?? p.id;
    if (onPick && id) onPick(id);
  };
  return (
    <div role="img" aria-label={label} className="h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={{ stroke: "var(--border)" }} interval={data.length > 16 ? 1 : 0} />
          <YAxis tick={axis} tickLine={false} axisLine={false} width={52} tickFormatter={yTick(metric)} />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            content={(p) => {
              const { active, payload } = p as unknown as { active?: boolean; payload?: { dataKey: ChannelKey; value: number; color: string; payload: ChannelTrendPoint }[] };
              if (!active || !payload?.length) return null;
              const point = payload[0].payload;
              const total = payload.reduce((s, x) => s + (x.value || 0), 0);
              return (
                <div style={box} className="min-w-56 px-3 py-2.5 shadow-sm">
                  <p className="mb-2 font-semibold">
                    {point.label}
                    {point.sub ? <span className="ml-1.5 font-normal text-muted-foreground">{point.sub}</span> : null}
                    <span className="ml-1.5 font-normal text-muted-foreground">· {unit}</span>
                  </p>
                  {[...payload].reverse().map((r) => {
                    const c = CHANNELS.find((x) => x.key === r.dataKey)!;
                    return (
                      <p key={r.dataKey} className="flex items-center justify-between gap-6 py-0.5 tabular-nums">
                        <span className="flex items-center gap-2">
                          <i aria-hidden className="size-2.5 rounded-[3px]" style={{ background: r.color }} />
                          <ChannelLogo channel={c} size="chip" />
                        </span>
                        <span>
                          {fmtFull(metric, r.value)} <span className="text-muted-foreground">{total ? Math.round((r.value / total) * 100) : 0}%</span>
                        </span>
                      </p>
                    );
                  })}
                  <p className="mt-1.5 flex justify-between border-t pt-1.5 font-semibold tabular-nums">
                    <span>Total</span>
                    {fmtFull(metric, total)}
                  </p>
                  {onPick ? <p className="mt-1.5 text-primary">Click to see its days</p> : null}
                </div>
              );
            }}
          />
          {keys.map((k, i) => (
            <Bar key={k} dataKey={k} stackId="s" fill={CHANNELS.find((c) => c.key === k)!.color} fillOpacity={focus && focus !== k ? 0.25 : 1} radius={i === keys.length - 1 ? [4, 4, 0, 0] : 0} isAnimationActive={!reduce} maxBarSize={48} cursor={onPick ? "pointer" : "default"} onClick={pick} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
