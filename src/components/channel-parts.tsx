"use client";

import { useEffect, useRef, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { fmtDelta, fmtFull } from "@/components/drill-chart";
import type { Channel, ChannelKey } from "@/lib/channel-mock";
import type { Metric } from "@/lib/overview-mock";
import { cn } from "@/lib/utils";

// The logo of a channel with no background of its own in light mode. In dark mode it sits on a white tile, because the
// logos are drawn for a light page. Files live in `public/logos/` (grab.svg, shopee.svg, foodpanda.svg, zeoniq.png).
// US Pizza uses `public/logo.svg`. If a file is missing the logo is replaced by a colour dot and the name, so the page
// never shows a broken image.
//
// Sizes: "tile" is a fixed 96 x 32 slot so logos line up in a list. "chip" is a small logo for filter chips and
// "kpi" is a larger one for a summary figure. Both are as wide as the logo needs.
//
// The US Pizza emblem does not spell a name, and in a small size it is easy to mistake for a red swatch, so the word
// "App" is written next to it. Pass `showName={false}` where the name is already written beside the logo.
export type LogoSize = "tile" | "chip" | "kpi";
const SLOT: Record<LogoSize, { box: string; img: string; word: string }> = {
  tile: { box: "h-8 w-24 shrink-0 justify-center gap-1.5 px-1 dark:px-2", img: "h-6 max-w-full", word: "text-xs" },
  chip: { box: "h-5 shrink-0 gap-1.5 dark:px-1.5", img: "h-4 max-w-20", word: "text-xs" },
  kpi: { box: "h-9 shrink-0 gap-2 dark:px-2", img: "h-7 max-w-32", word: "text-sm" },
};
export function ChannelLogo({ channel, className, size = "tile", showName = true }: { channel: Channel; className?: string; size?: LogoSize; showName?: boolean }) {
  const [failed, setFailed] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  // An image that failed before the page was interactive never fires onError again, so check once on mount.
  useEffect(() => {
    const el = img.current;
    if (el && el.complete && el.naturalWidth === 0) setFailed(true);
  }, []);

  if (failed) {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-sm font-medium", size === "tile" && "h-8", className)}>
        <i aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: channel.color }} />
        {channel.label}
      </span>
    );
  }
  const s = SLOT[size];
  return (
    <span className={cn("inline-flex items-center rounded-md dark:bg-white", s.box, className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={img} src={channel.logo} alt={channel.label} onError={() => setFailed(true)} className={cn("w-auto shrink-0 object-contain", s.img)} />
      {!channel.named && showName ? <span aria-hidden className={cn("shrink-0 font-semibold whitespace-nowrap text-foreground dark:text-neutral-900", s.word)}>{channel.short}</span> : null}
    </span>
  );
}


export type DonutRow = { k: ChannelKey; channel: Channel; value: number; prev: number | null };

// Net sales (or orders) by channel as a large ring. Each slice is labelled with the channel's logo and its share, so the
// logos are the legend. The figures are in a panel under the ring, never over it: point at a slice (or click it to focus
// the channel everywhere on the page) and the panel shows that channel's figures. The ring is not animated, so the logos
// are there at once.
export function ChannelDonut({ rows, total, metric, measureLabel, focus, onPick }: { rows: DonutRow[]; total: number; metric: Metric; measureLabel: string; focus: ChannelKey | null; onPick: (k: ChannelKey) => void }) {
  const [hover, setHover] = useState<ChannelKey | null>(null);
  const pct = (v: number) => (total ? Math.round((v / total) * 100) : 0);
  const desc = `${measureLabel} by channel. ${rows.map((r) => `${r.channel.label} ${pct(r.value)} percent`).join(", ")}.`;
  const shown = rows.find((r) => r.k === (hover ?? focus)) ?? null;
  const delta = shown && shown.prev && shown.prev > 0 ? shown.value / shown.prev - 1 : null;

  // The label of one slice: the logo and the share, just outside the ring.
  const sliceLabel = (p: unknown) => {
    const { cx, cy, midAngle, outerRadius, index } = p as { cx: number; cy: number; midAngle: number; outerRadius: number; index: number };
    const row = rows[index];
    if (!row) return null;
    const rad = Math.PI / 180;
    const r = outerRadius + 46;
    const x = cx + r * Math.cos(-midAngle * rad);
    const y = cy + r * Math.sin(-midAngle * rad);
    const on = !hover && !focus ? true : (hover ?? focus) === row.k;
    return (
      <g opacity={on ? 1 : 0.35} style={{ cursor: "pointer" }} onClick={() => onPick(row.k)} onMouseEnter={() => setHover(row.k)} onMouseLeave={() => setHover(null)}>
        <rect x={x - 38} y={y - 18} width={76} height={28} rx={6} className="fill-transparent dark:fill-white" />
        {row.channel.named ? (
          <image href={row.channel.logo} x={x - 34} y={y - 16} width={68} height={24} preserveAspectRatio="xMidYMid meet" />
        ) : (
          <>
            <image href={row.channel.logo} x={x - 34} y={y - 16} width={34} height={24} preserveAspectRatio="xMidYMid meet" />
            <text x={x + 2} y={y + 1} style={{ fontSize: 13, fontWeight: 600 }} className="fill-foreground dark:fill-neutral-900">
              {row.channel.short}
            </text>
          </>
        )}
        <text x={x} y={y + 26} textAnchor="middle" style={{ fontSize: 13, fontWeight: 600, fill: "var(--foreground)" }}>
          {pct(row.value)}%
        </text>
      </g>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div role="img" aria-label={desc} className="relative h-[440px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={rows}
              dataKey="value"
              nameKey="k"
              innerRadius="40%"
              outerRadius="62%"
              startAngle={90}
              endAngle={-270}
              paddingAngle={rows.length > 1 ? 2 : 0}
              stroke="var(--card)"
              strokeWidth={2}
              isAnimationActive={false}
              cursor="pointer"
              label={sliceLabel}
              labelLine={false}
              onMouseEnter={(_, i) => setHover(rows[i]?.k ?? null)}
              onMouseLeave={() => setHover(null)}
              onClick={(d) => onPick(((d as unknown as { payload?: DonutRow; k?: ChannelKey }).payload?.k ?? (d as unknown as DonutRow).k) as ChannelKey)}
            >
              {rows.map((r) => {
                const on = !hover && !focus ? true : (hover ?? focus) === r.k;
                return <Cell key={r.k} fill={r.channel.color} fillOpacity={on ? 1 : 0.3} />;
              })}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-sm text-muted-foreground">{measureLabel}</p>
            <p className="text-2xl leading-tight font-semibold tabular-nums">{fmtFull(metric, total)}</p>
          </div>
        </div>
      </div>

      <div aria-live="polite" className="min-h-[96px] rounded-lg border bg-muted/40 p-4">
        {shown ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <ChannelLogo channel={shown.channel} size="kpi" showName={false} />
              <span className="text-base font-semibold">{shown.channel.label}</span>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs text-muted-foreground">{measureLabel}</dt>
                <dd className="font-semibold tabular-nums">{fmtFull(metric, shown.value)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Share of total</dt>
                <dd className="font-semibold tabular-nums">{pct(shown.value)}%</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Against the period before</dt>
                <dd className={cn("font-semibold tabular-nums", delta !== null && delta < 0 && "text-danger")}>{delta !== null ? fmtDelta(delta) : "–"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Average order</dt>
                <dd className="font-semibold tabular-nums">RM {shown.channel.aov}</dd>
              </div>
            </dl>
          </div>
        ) : (
          <p className="py-3 text-center text-sm text-muted-foreground">Point at a slice to see its figures. Click it to focus that channel on the page.</p>
        )}
      </div>
    </div>
  );
}
