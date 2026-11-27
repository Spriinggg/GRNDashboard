"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChannelLogo } from "@/components/channel-parts";
import { fmtFull, fmtShort } from "@/components/drill-chart";
import { CHANNELS } from "@/lib/channel-mock";
import type { ChannelKey, FeeRow } from "@/lib/channel-mock";
import { cn } from "@/lib/utils";

// Fee types in the order the platforms list them. One hue in different strengths keeps the page calm. The same colours
// are used in the rate bars and in the steps of the waterfall, so a colour means the same fee everywhere.
export const FEE_PARTS = [
  { key: "commission", label: "Commission", short: "Commission", color: "var(--primary)", opacity: 1 },
  { key: "ads", label: "Advertising", short: "Advertising", color: "var(--primary)", opacity: 0.55 },
  { key: "service", label: "Platform / service fee", short: "Service fee", color: "var(--muted-foreground)", opacity: 0.6 },
  { key: "gateway", label: "Payment gateway", short: "Gateway", color: "var(--muted-foreground)", opacity: 0.35 },
  { key: "adjust", label: "Adjustments / credits", short: "Adjustments", color: "var(--foreground)", opacity: 0.3 },
] as const;
type PartKey = (typeof FEE_PARTS)[number]["key"];

const feeOf = (f: Pick<FeeRow, PartKey>) => FEE_PARTS.reduce((s, p) => s + f[p.key], 0);
const pct = (v: number, of: number) => (of ? `${((v / of) * 100).toFixed(1)}%` : "0%");
const box = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 } as const;
const axis = { fontSize: 12, fill: "var(--muted-foreground)" } as const;

type Subject = Pick<FeeRow, "sales" | PartKey>;
type Step = { name: string; base: number; value: number; text: string; fill: string; opacity: number; share: string | null; sales: number };

// What the delivery platforms (and the payment gateway of the app) take, in two views that answer one question each.
// Left: which channel takes the biggest share of its sales, as a bar split by fee type. Click a channel to look at it.
// Right: where the sales of the chosen channel go, from the sales figure down through each fee to what is left.
// The figures sit in the tooltip, so the screen shows the shape first and the detail on demand.
export function FeeExplorer({ fees }: { fees: FeeRow[] }) {
  const [pick, setPick] = useState<ChannelKey | "all">("all");
  const active = pick !== "all" && fees.some((f) => f.key === pick) ? pick : "all";

  const all: Subject = { sales: 0, commission: 0, ads: 0, service: 0, gateway: 0, adjust: 0 };
  for (const f of fees) {
    all.sales += f.sales;
    for (const p of FEE_PARTS) all[p.key] += f[p.key];
  }
  const subject: Subject = active === "all" ? all : fees.find((f) => f.key === active)!;
  const channel = active === "all" ? null : CHANNELS.find((c) => c.key === active)!;
  const maxRate = Math.max(0.0001, ...fees.map((f) => feeOf(f) / f.sales), feeOf(all) / (all.sales || 1));

  // The waterfall: sales, then each fee that applies stepping down, then what is left.
  const steps: Step[] = [{ name: "Net sales", base: 0, value: subject.sales, text: fmtShort("sales", subject.sales).replace("RM ", ""), fill: "var(--muted-foreground)", opacity: 0.7, share: null, sales: subject.sales }];
  let run = subject.sales;
  const feeTotal = feeOf(subject);
  for (const p of FEE_PARTS) {
    const v = subject[p.key];
    if (v < 0.5) continue;
    run -= v;
    steps.push({ name: p.short, base: run, value: v, text: `−${fmtShort("sales", v).replace("RM ", "")}`, fill: p.color, opacity: p.opacity, share: pct(v, feeTotal), sales: subject.sales });
  }
  steps.push({ name: "Left after fees", base: 0, value: subject.sales - feeTotal, text: fmtShort("sales", subject.sales - feeTotal).replace("RM ", ""), fill: "var(--foreground)", opacity: 0.75, share: null, sales: subject.sales });

  const rows: { key: ChannelKey | "all"; f: Subject }[] = [{ key: "all", f: all }, ...fees.map((f) => ({ key: f.key as ChannelKey, f }))];

  return (
    <section aria-label="What the platforms take" className="grid lg:grid-cols-12">
      <div className="flex min-w-0 flex-col gap-3 border-b p-6 lg:col-span-5 lg:border-r lg:border-b-0">
        <div>
          <h2 className="text-base font-semibold">What the platforms take</h2>
          <p className="text-xs text-muted-foreground">
            <b className="font-semibold text-foreground tabular-nums">{fmtFull("sales", feeOf(all))}</b> in fees, {pct(feeOf(all), all.sales)} of these channels&apos; sales. Click a channel to follow its sales.
          </p>
        </div>
        <ul className="flex flex-col gap-1" aria-label="Fee rate by channel">
          {rows.map(({ key, f }) => {
            const rate = f.sales ? feeOf(f) / f.sales : 0;
            const on = active === key;
            const ch = key === "all" ? null : CHANNELS.find((c) => c.key === key)!;
            const total = feeOf(f);
            return (
              <li key={key}>
                <button
                  type="button"
                  aria-pressed={on}
                  aria-label={`${ch ? ch.label : "All channels"}: fees ${pct(total, f.sales)} of sales, ${fmtFull("sales", total)}. Show where its sales go`}
                  onClick={() => setPick(on && key !== "all" ? "all" : key)}
                  className={cn("flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring", on && "bg-muted")}
                >
                  {ch ? <ChannelLogo channel={ch} /> : <span className="inline-flex h-8 w-24 shrink-0 items-center text-sm font-semibold">All channels</span>}
                  <span className="block h-3 min-w-0 flex-1 rounded-full bg-muted">
                    <span className="flex h-full overflow-hidden rounded-full" style={{ width: `${Math.max((rate / maxRate) * 100, 2)}%` }}>
                      {FEE_PARTS.map((p) => (
                        <i key={p.key} className="block h-full" style={{ width: `${total ? (f[p.key] / total) * 100 : 0}%`, background: p.color, opacity: p.opacity }} />
                      ))}
                    </span>
                  </span>
                  <span className="w-20 shrink-0 text-right text-sm tabular-nums">
                    <b className="font-semibold">{pct(total, f.sales)}</b>
                    <span className="block text-xs text-muted-foreground">{fmtShort("sales", total)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {FEE_PARTS.map((p) => (
            <span key={p.key} className="flex items-center gap-1.5">
              <i aria-hidden className="inline-block size-2.5 rounded-[3px]" style={{ background: p.color, opacity: p.opacity }} /> {p.short}
            </span>
          ))}
        </p>
      </div>

      <div className="flex min-w-0 flex-col gap-3 p-6 lg:col-span-7">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 className="text-base font-semibold">Where the sales go</h2>
          {channel ? <ChannelLogo channel={channel} size="chip" /> : <span className="text-sm text-muted-foreground">All fee channels</span>}
        </div>
        <p className="-mt-2 text-xs text-muted-foreground">In ringgit. From the sales figure down through each fee to what is left. Point at a step for the exact figures.</p>
        <div role="img" aria-label={`Sales ${fmtFull("sales", subject.sales)}, fees ${fmtFull("sales", feeTotal)}, left after fees ${fmtFull("sales", subject.sales - feeTotal)}.`} className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={steps} margin={{ top: 24, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="name" tick={axis} tickLine={false} axisLine={{ stroke: "var(--border)" }} interval={0} />
              <YAxis tick={axis} tickLine={false} axisLine={false} width={52} tickFormatter={(v) => fmtShort("sales", Number(v)).replace("RM ", "")} />
              <Tooltip
                cursor={{ fill: "var(--muted)" }}
                content={(p) => {
                  const { active: on, payload } = p as unknown as { active?: boolean; payload?: { payload: Step }[] };
                  const s = on && payload?.[0]?.payload;
                  if (!s) return null;
                  return (
                    <div style={box} className="min-w-48 px-3 py-2.5 shadow-sm">
                      <p className="mb-1.5 flex items-center gap-2 font-semibold">{channel ? <ChannelLogo channel={channel} size="chip" /> : null}{s.name}</p>
                      <p className="flex justify-between gap-6 tabular-nums"><span className="text-muted-foreground">Amount</span><b className="font-semibold">{fmtFull("sales", s.value)}</b></p>
                      <p className="flex justify-between gap-6 tabular-nums"><span className="text-muted-foreground">Of net sales</span><b className="font-semibold">{pct(s.value, s.sales)}</b></p>
                      {s.share ? <p className="flex justify-between gap-6 tabular-nums"><span className="text-muted-foreground">Of all fees</span><b className="font-semibold">{s.share}</b></p> : null}
                    </div>
                  );
                }}
              />
              <Bar dataKey="base" stackId="w" fill="transparent" isAnimationActive={false} />
              <Bar dataKey="value" stackId="w" radius={4} maxBarSize={72} isAnimationActive={false}>
                {steps.map((s) => (
                  <Cell key={s.name} fill={s.fill} fillOpacity={s.opacity} />
                ))}
                <LabelList dataKey="text" position="top" style={{ fontSize: 12, fontWeight: 600, fill: "var(--foreground)" }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
