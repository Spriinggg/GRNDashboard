// SAMPLE DATA for the Profit & loss design. Nothing here comes from Supabase, POS, the GRN files or the stock count.
// It is built on the same outlets, daily sales, channel split and platform fees as the two Sales pages (overview-mock.ts
// and channel-mock.ts), so a figure agrees with the other pages. Purchases and food used are made up from the food cost
// of each outlet. Replace the builders with queries later and keep the shapes.
import { CHANNEL_KEYS, channelFeesFor } from "@/lib/channel-mock";
import type { ChannelKey } from "@/lib/channel-mock";
import { LAST_M, MONTHS, OUTLETS, fcPct, lastDay, periodOf, rnd, sumDays } from "@/lib/overview-mock";
import type { PeriodKey, Range } from "@/lib/overview-mock";
import type { Region } from "@/lib/outlet-locations";

// Which figure is the cost of food. Purchases is what was received on the GRN (goods received, not goods used).
// Food used is what the stock count and movement say was used. The gap between the two is stock built up or run down.
export type Basis = "grn" | "used";
export const BASIS_LABEL: Record<Basis, string> = { grn: "Purchases (GRN)", used: "Food used (stock count)" };

export type Fees = { commission: number; ads: number; service: number; gateway: number; adjust: number; total: number };
export type Pnl = { sales: number; byChannel: Record<ChannelKey, number>; fees: Fees; grn: number; used: number };

const zeroPnl = (): Pnl => ({ sales: 0, byChannel: { walkin: 0, app: 0, grab: 0, shopee: 0, panda: 0 }, fees: { commission: 0, ads: 0, service: 0, gateway: 0, adjust: 0, total: 0 }, grn: 0, used: 0 });

// Purchases against food used in one month: from 8% less to 12% more, mostly more (stock builds up).
const swing = (name: string, m: number) => (rnd(`st${name}${m}`) - 0.4) * 0.2;

export function pnlOf(name: string, ranges: Range[]): Pnl {
  const o = OUTLETS.find((x) => x.name === name)!;
  const { vals, fee } = channelFeesFor(name, ranges);
  const p = zeroPnl();
  for (const k of CHANNEL_KEYS) {
    p.byChannel[k] = vals[k];
    p.sales += vals[k];
  }
  for (const f of Object.values(fee)) {
    p.fees.commission += f.commission;
    p.fees.ads += f.ads;
    p.fees.service += f.service;
    p.fees.gateway += f.gateway;
    p.fees.adjust += f.adjust;
  }
  p.fees.total = p.fees.commission + p.fees.ads + p.fees.service + p.fees.gateway + p.fees.adjust;
  for (const [m, a, b] of ranges) {
    const used = (sumDays(o, m, a, b) * fcPct(o, m)) / 100;
    p.used += used;
    p.grn += used * (1 + swing(name, m));
  }
  return p;
}

export function addPnl(a: Pnl, b: Pnl): Pnl {
  const out = zeroPnl();
  out.sales = a.sales + b.sales;
  out.grn = a.grn + b.grn;
  out.used = a.used + b.used;
  for (const k of CHANNEL_KEYS) out.byChannel[k] = a.byChannel[k] + b.byChannel[k];
  for (const k of Object.keys(out.fees) as (keyof Fees)[]) out.fees[k] = a.fees[k] + b.fees[k];
  return out;
}

export const costOf = (p: Pnl, basis: Basis) => (basis === "grn" ? p.grn : p.used);
export const grossOf = (p: Pnl, basis: Basis) => p.sales - p.fees.total - costOf(p, basis);
export const marginOf = (p: Pnl, basis: Basis) => (p.sales ? grossOf(p, basis) / p.sales : 0);

export type OutletPnl = { name: string; area: string; region: Region; p: Pnl; prev: Pnl | null };
export type PnlView = { rows: OutletPnl[]; total: Pnl; prevTotal: Pnl | null };

// Every outlet in the region for the period, with the same period before it where there is one.
export function pnlView(region: "all" | Region, period: PeriodKey, q: string): PnlView {
  const pd = periodOf(period);
  const needle = q.trim().toLowerCase();
  const rows: OutletPnl[] = [];
  let total = zeroPnl();
  let prevTotal: Pnl | null = pd.prev ? zeroPnl() : null;
  for (const o of OUTLETS) {
    if (region !== "all" && o.region !== region) continue;
    if (needle && !(o.name + " " + o.area).toLowerCase().includes(needle)) continue;
    const p = pnlOf(o.name, pd.ranges);
    if (!p.sales) continue;
    const prev = pd.prev ? pnlOf(o.name, pd.prev) : null;
    rows.push({ name: o.name, area: o.area, region: o.region, p, prev });
    total = addPnl(total, p);
    if (prev && prevTotal) prevTotal = addPnl(prevTotal, prev);
  }
  return { rows, total, prevTotal };
}

export function pnlOne(name: string, period: PeriodKey): { p: Pnl; prev: Pnl | null } {
  const pd = periodOf(period);
  return { p: pnlOf(name, pd.ranges), prev: pd.prev ? pnlOf(name, pd.prev) : null };
}

export type PnlTrendPoint = { id: string; label: string; sales: number; gp: number; margin: number; grn: number; used: number };
// Each month of the year for the outlets given. Money is the average per day, so a part month (November) is not
// drawn as a drop. Margin is a share of sales, so it needs no such care.
export function pnlTrend(names: string[], basis: Basis): PnlTrendPoint[] {
  const out: PnlTrendPoint[] = [];
  for (let m = 0; m <= LAST_M; m++) {
    const days = lastDay(m);
    let t = zeroPnl();
    for (const n of names) t = addPnl(t, pnlOf(n, [[m, 1, days]]));
    if (!t.sales) continue;
    out.push({ id: String(m), label: MONTHS[m], sales: t.sales / days, gp: grossOf(t, basis) / days, margin: marginOf(t, basis) * 100, grn: t.grn / days, used: t.used / days });
  }
  return out;
}
