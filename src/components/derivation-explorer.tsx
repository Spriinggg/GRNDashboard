"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChannelLogo } from "@/components/channel-parts";
import { fmtFull } from "@/components/drill-chart";
import { FEE_PARTS } from "@/components/fee-breakdown";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CHANNELS, collectedOf, feesOf, keptOf, settlementOf } from "@/lib/channel-mock";
import type { ChannelKey, DeriveRow } from "@/lib/channel-mock";
import { cn } from "@/lib/utils";

const box = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 } as const;
const axis = { fontSize: 12, fill: "var(--muted-foreground)" } as const;
const pct = (v: number, of: number) => (of ? `${((v / of) * 100).toFixed(1)}%` : "0%");
// 4,407,171 reads 4.41m, 578,621 reads 579k. The axis uses one decimal so the ticks stay short.
const short = (v: number, decimals = 2) => {
  const a = Math.abs(v);
  const sign = v < 0 ? "−" : "";
  if (a >= 1e6) return `${sign}${(a / 1e6).toFixed(decimals).replace(/\.?0+$/, "")}m`;
  if (a >= 1e3) return `${sign}${Math.round(a / 1e3)}k`;
  return `${sign}${Math.round(a)}`;
};

const sum = (rows: DeriveRow[]): DeriveRow => {
  const t: DeriveRow = { key: "walkin", gross: 0, discount: 0, net: 0, sc: 0, sst: 0, commission: 0, ads: 0, service: 0, gateway: 0, adjust: 0 };
  for (const r of rows) for (const k of ["gross", "discount", "net", "sc", "sst", "commission", "ads", "service", "gateway", "adjust"] as const) t[k] += r[k];
  return t;
};

type Step = { name: string; base: number; value: number; text: string; fill: string; opacity: number; of: "gross" | "fees" | null; feeShare: string | null };

// The whole path of a sale, one step each: gross sales, less the discount, net sales, plus the service charge and SST the
// customer pays, collected sales, less each fee, and what is left (net settlement). Net sales is the figure used everywhere
// else in the app (before SST and service charge). Service charge and SST are collected for others, so they are not income.
function stepsOf(r: DeriveRow): Step[] {
  const out: Step[] = [];
  const add = (name: string, base: number, value: number, sign: "" | "+" | "−", fill: string, opacity: number, of: Step["of"], feeShare: string | null = null) =>
    out.push({ name, base, value, text: `${sign}${short(value)}`, fill, opacity, of, feeShare });
  add("Gross sales", 0, r.gross, "", "var(--muted-foreground)", 0.5, null);
  if (r.discount > 0.5) add("Discount", r.gross - r.discount, r.discount, "−", "var(--muted-foreground)", 0.3, "gross");
  add("Net sales", 0, r.net, "", "var(--foreground)", 0.7, "gross");
  if (r.sc > 0.5) add("Service charge", r.net, r.sc, "+", "var(--muted-foreground)", 0.45, "gross");
  if (r.sst > 0.5) add("SST", r.net + r.sc, r.sst, "+", "var(--muted-foreground)", 0.45, "gross");
  const collected = collectedOf(r);
  add("Collected", 0, collected, "", "var(--foreground)", 0.7, "gross");
  const fees = feesOf(r);
  let run = collected;
  for (const p of FEE_PARTS) {
    const v = r[p.key];
    if (v < 0.5) continue;
    run -= v;
    add(p.short, run, v, "−", p.color, p.opacity, "gross", pct(v, fees));
  }
  add("Net settlement", 0, collected - fees, "", "var(--primary)", 0.95, "gross");
  return out;
}

// From gross sales to net settlement for the channels chosen, and how much of each ringgit is kept. The list picks a channel and
// the chart shows its path. The full table is one click away, so the screen shows the shape first and the detail on demand.
export function DerivationExplorer({ rows, scope }: { rows: DeriveRow[]; scope: string }) {
  const [pick, setPick] = useState<ChannelKey | "all">("all");
  const live = rows.filter((r) => r.gross > 0);
  const active = pick !== "all" && live.some((r) => r.key === pick) ? pick : "all";
  const all = sum(live);
  const subject = active === "all" ? all : live.find((r) => r.key === active)!;
  const channel = active === "all" ? null : CHANNELS.find((c) => c.key === active)!;
  const steps = stepsOf(subject);
  const settle = settlementOf(subject);
  const list: { key: ChannelKey | "all"; r: DeriveRow }[] = [{ key: "all", r: all }, ...live.map((r) => ({ key: r.key as ChannelKey, r }))];

  if (!live.length) return <p className="p-6 text-center text-sm text-muted-foreground">Select a channel to see how its sales are kept.</p>;

  return (
    <section aria-label="From gross sales to net settlement">
      <div className="grid lg:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-3 border-b p-6 lg:col-span-5 lg:border-r lg:border-b-0">
          <div>
            <h2 className="text-base font-semibold">What is kept of every ringgit</h2>
            <p className="text-xs text-muted-foreground">
              {scope}. Of every RM 100 of gross sales, <b className="font-semibold text-foreground tabular-nums">RM {(keptOf(all) * 100).toFixed(1)}</b> is left after discount and fees. Click a channel to follow its sales.
            </p>
          </div>
          <ul className="flex flex-col gap-1" aria-label="Share of gross sales kept, by channel">
            {list.map(({ key, r }) => {
              const on = active === key;
              const ch = key === "all" ? null : CHANNELS.find((c) => c.key === key)!;
              const kept = keptOf(r);
              return (
                <li key={key}>
                  <button
                    type="button"
                    aria-pressed={on}
                    aria-label={`${ch ? ch.label : "All channels"}: ${(kept * 100).toFixed(1)}% of gross sales kept, net settlement ${fmtFull("sales", settlementOf(r))}. Show where its sales go`}
                    onClick={() => setPick(on && key !== "all" ? "all" : key)}
                    className={cn("flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring", on && "bg-muted")}
                  >
                    {ch ? <ChannelLogo channel={ch} /> : <span className="inline-flex h-8 w-24 shrink-0 items-center text-sm font-semibold">All channels</span>}
                    <span className="block h-3 min-w-0 flex-1 rounded-full bg-muted">
                      <i className={cn("block h-full rounded-full", on ? "bg-primary" : "bg-foreground/55")} style={{ width: `${Math.max(Math.min(kept, 1.05) * 100, 2)}%` }} />
                    </span>
                    <span className="w-20 shrink-0 text-right text-sm tabular-nums">
                      <b className="font-semibold">{(kept * 100).toFixed(1)}%</b>
                      <span className="block text-xs text-muted-foreground">RM {short(settlementOf(r))}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted-foreground">Kept is net settlement as a share of gross sales. The app can read above 100% because it adds the service charge and SST it collects and pays no fee.</p>
        </div>

        <div className="flex min-w-0 flex-col gap-3 p-6 lg:col-span-7">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="text-base font-semibold">From gross sales to net settlement</h2>
            {channel ? <ChannelLogo channel={channel} size="chip" /> : <span className="text-sm text-muted-foreground">All channels</span>}
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">In ringgit. Net sales is before SST and service charge. Collected is what the customers paid. Point at a step for the exact figures.</p>
          <div role="img" aria-label={`Gross sales ${fmtFull("sales", subject.gross)}, discount ${fmtFull("sales", subject.discount)}, net sales ${fmtFull("sales", subject.net)}, collected ${fmtFull("sales", collectedOf(subject))}, fees ${fmtFull("sales", feesOf(subject))}, net settlement ${fmtFull("sales", settle)}.`} style={{ height: steps.length * 36 + 12 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={steps} layout="vertical" margin={{ top: 4, right: 64, bottom: 0, left: 0 }} barCategoryGap={8}>
                <CartesianGrid horizontal={false} stroke="var(--border)" />
                <XAxis type="number" hide domain={[0, Math.max(...steps.map((x) => x.base + x.value)) * 1.04]} />
                <YAxis type="category" dataKey="name" width={118} tickLine={false} axisLine={false} interval={0} tick={{ ...axis, fill: "var(--foreground)" }} />
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
                        <p className="flex justify-between gap-6 tabular-nums"><span className="text-muted-foreground">Of gross sales</span><b className="font-semibold">{pct(s.value, subject.gross)}</b></p>
                        <p className="flex justify-between gap-6 tabular-nums"><span className="text-muted-foreground">Of net sales</span><b className="font-semibold">{pct(s.value, subject.net)}</b></p>
                        {s.feeShare ? <p className="flex justify-between gap-6 tabular-nums"><span className="text-muted-foreground">Of all fees</span><b className="font-semibold">{s.feeShare}</b></p> : null}
                      </div>
                    );
                  }}
                />
                <Bar dataKey="base" stackId="w" fill="transparent" isAnimationActive={false} />
                <Bar dataKey="value" stackId="w" radius={4} maxBarSize={22} isAnimationActive={false}>
                  {steps.map((s) => (
                    <Cell key={s.name} fill={s.fill} fillOpacity={s.opacity} />
                  ))}
                  <LabelList dataKey="text" position="right" style={{ fontSize: 12, fontWeight: 600, fill: "var(--foreground)" }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted-foreground">Service charge and SST are collected for others, so they are not income. They are left out of the Profit &amp; loss page, which starts from net sales.</p>
        </div>
      </div>

      <details className="group border-t">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-6 py-3 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset [&::-webkit-details-marker]:hidden">
          <span aria-hidden className="inline-block text-xs text-muted-foreground transition-transform group-open:rotate-90">▶</span>
          Full table, every channel side by side
        </summary>
        <div className="overflow-x-auto px-2 pb-3">
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-3 text-left">In ringgit</TableHead>
                {live.map((r) => (
                  <TableHead key={r.key} className="text-right">
                    <span className="inline-flex justify-end"><ChannelLogo channel={CHANNELS.find((c) => c.key === r.key)!} size="chip" /></span>
                  </TableHead>
                ))}
                <TableHead className="pr-3 text-right">All channels</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(
                [
                  ["Gross sales", (r: DeriveRow) => r.gross, false],
                  ["− Discount", (r: DeriveRow) => r.discount, false],
                  ["= Net sales", (r: DeriveRow) => r.net, true],
                  ["+ Service charge", (r: DeriveRow) => r.sc, false],
                  ["+ SST (tax)", (r: DeriveRow) => r.sst, false],
                  ["= Collected sales", (r: DeriveRow) => collectedOf(r), true],
                  ["− Commission and fees", (r: DeriveRow) => feesOf(r), false],
                  ["= Net settlement", (r: DeriveRow) => settlementOf(r), true],
                ] as const
              ).map(([label, f, strong]) => (
                <TableRow key={label}>
                  <TableCell className={cn("pl-3", strong && "font-semibold")}>{label}</TableCell>
                  {live.map((r) => (
                    <TableCell key={r.key} className={cn("text-right tabular-nums", strong && "font-semibold")}>{f(r) < 0.5 ? "–" : fmtFull("sales", f(r))}</TableCell>
                  ))}
                  <TableCell className={cn("pr-3 text-right tabular-nums", strong && "font-semibold")}>{fmtFull("sales", f(all))}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell className="pl-3 text-muted-foreground">Kept, % of gross</TableCell>
                {live.map((r) => (
                  <TableCell key={r.key} className="text-right tabular-nums">{(keptOf(r) * 100).toFixed(1)}%</TableCell>
                ))}
                <TableCell className="pr-3 text-right tabular-nums">{(keptOf(all) * 100).toFixed(1)}%</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </details>
    </section>
  );
}
