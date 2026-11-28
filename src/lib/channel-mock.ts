// SAMPLE DATA for the Sales by channel design. Nothing here comes from Supabase, POS or the delivery apps. The rates are set from
// the September 2026 dashboard, but every figure is still generated.
// Built on the same outlets and daily sales as overview-mock.ts, then split into channels with fixed rules,
// so every outlet and period shows the same numbers each time. Replace the builders with queries later.
import { DOW, LAST_M, MONTHS, OUTLETS, YEAR, lastDay, periodOf, rnd, sumDays } from "@/lib/overview-mock";
import type { Metric, PeriodKey, Range } from "@/lib/overview-mock";
import type { Region } from "@/lib/outlet-locations";

export type ChannelKey = "walkin" | "app" | "grab" | "shopee" | "panda";
export type Channel = { key: ChannelKey; label: string; short: string; logo: string; named: boolean; color: string; aov: number; platform: boolean; share: number; growth: number; commission: number; ads: number; service: number; gateway: number; adjust: number; disc: number; scRate: number; sstRate: number };

// share: typical part of sales. growth: how the share drifts through the year.
// Fee rates are a share of the channel's own net sales: commission, advertising, platform or service fee, payment gateway and
// adjustments or credits. disc is the discount as a share of GROSS sales. scRate (service charge) and sstRate (SST) are a share
// of NET sales. All of these rates are set from the September 2026 sales dashboard, so the sample figures have the same shape as
// the real ones: Grab keeps about 52% of gross, FoodPanda 56%, Shopee 69%. Only POS and the app carry a service charge (dine-in).
// The US Pizza app has no fee data in the September export, so its gateway rate is 0. Replace with real figures later.
export const CHANNELS: Channel[] = [
  { key: "walkin", label: "POS (Zeoniq)", short: "POS", logo: "/logos/zeoniq.png", named: true, color: "var(--muted-foreground)", aov: 22, platform: false, share: 0.52, growth: -0.006, commission: 0, ads: 0, service: 0, gateway: 0, adjust: 0, disc: 0.229, scRate: 0.0103, sstRate: 0.0598 },
  { key: "app", label: "US Pizza App", short: "App", logo: "/logo.svg", named: false, color: "var(--primary)", aov: 31, platform: false, share: 0.08, growth: 0.03, commission: 0, ads: 0, service: 0, gateway: 0, adjust: 0, disc: 0.062, scRate: 0.0262, sstRate: 0.0588 },
  { key: "grab", label: "GrabFood", short: "Grab", logo: "/logos/grab.svg", named: true, color: "#2f9e44", aov: 36, platform: true, share: 0.18, growth: 0.012, commission: 0.311, ads: 0.092, service: 0.013, gateway: 0, adjust: 0.002, disc: 0.1865, scRate: 0, sstRate: 0.0599 },
  { key: "shopee", label: "ShopeeFood", short: "Shopee", logo: "/logos/shopee.svg", named: true, color: "#f08c00", aov: 34, platform: true, share: 0.12, growth: 0.015, commission: 0.047, ads: 0, service: 0, gateway: 0, adjust: 0, disc: 0.316, scRate: 0, sstRate: 0.0596 },
  { key: "panda", label: "FoodPanda", short: "Panda", logo: "/logos/foodpanda.svg", named: true, color: "#e64980", aov: 37, platform: true, share: 0.1, growth: 0.008, commission: 0.189, ads: 0.113, service: 0.005, gateway: 0, adjust: 0.018, disc: 0.226, scRate: 0, sstRate: 0.0531 },
];
export const CHANNEL_KEYS = CHANNELS.map((c) => c.key);

type Vals = Record<ChannelKey, number>;
const zero = (): Vals => ({ walkin: 0, app: 0, grab: 0, shopee: 0, panda: 0 });

// Share of each channel for one outlet in one month. Adds up to 1.
function shares(name: string, m: number): Vals {
  const w = zero();
  let sum = 0;
  for (const c of CHANNELS) {
    w[c.key] = c.share * (0.7 + rnd(`ch${name}${c.key}`) * 0.6) * (1 + m * c.growth);
    sum += w[c.key];
  }
  for (const c of CHANNELS) w[c.key] /= sum;
  return w;
}

const conv = (c: Channel, metric: Metric, sales: number) => (metric === "sales" ? sales : Math.round(sales / c.aov));

export type ChannelRow = { name: string; area: string; region: Region; vals: Vals; total: number };
export type FeeRow = { key: ChannelKey; sales: number; commission: number; ads: number; service: number; gateway: number; adjust: number };
export type ChannelView = { rows: ChannelRow[]; totals: Vals; prevTotals: Vals | null; fees: FeeRow[]; derive: DeriveRow[] };

// An empty fee record for every channel that carries fees (the delivery platforms and the payment gateway of the app).
const newFees = () => Object.fromEntries(CHANNELS.filter((c) => c.commission + c.ads + c.service + c.gateway + c.adjust > 0).map((c) => [c.key, { key: c.key, sales: 0, commission: 0, ads: 0, service: 0, gateway: 0, adjust: 0 }])) as Record<ChannelKey, FeeRow>;

// From net sales down to settlement, for one channel: gross, discount, net, service charge and SST. Fees are kept apart (FeeRow).
export type Deriv = { gross: number; discount: number; net: number; sc: number; sst: number };
export type DeriveRow = Deriv & { key: ChannelKey; commission: number; ads: number; service: number; gateway: number; adjust: number };
const newDeriv = () => Object.fromEntries(CHANNELS.map((c) => [c.key, { gross: 0, discount: 0, net: 0, sc: 0, sst: 0 }])) as Record<ChannelKey, Deriv>;

export const collectedOf = (d: Deriv) => d.net + d.sc + d.sst; // what the customers paid: net sales plus service charge and SST
export const feesOf = (r: Pick<DeriveRow, "commission" | "ads" | "service" | "gateway" | "adjust">) => r.commission + r.ads + r.service + r.gateway + r.adjust;
export const settlementOf = (r: DeriveRow) => collectedOf(r) - feesOf(r); // what is left after the platforms take their fees
export const keptOf = (r: DeriveRow) => (r.gross ? settlementOf(r) / r.gross : 0); // of every ringgit of gross sales, how much is kept

function over(name: string, ranges: Range[], metric: Metric, fee?: Record<ChannelKey, FeeRow>, dv?: Record<ChannelKey, Deriv>): Vals {
  const o = OUTLETS.find((x) => x.name === name)!;
  const out = zero();
  for (const [m, a, b] of ranges) {
    const day = sumDays(o, m, a, b);
    const s = shares(name, m);
    // Whole ringgit per channel, and Walk-in takes the remainder, so the channels always add up to the outlet's day total.
    const part = zero();
    for (const c of CHANNELS) if (c.key !== "walkin") part[c.key] = Math.round(day * s[c.key]);
    part.walkin = day - part.app - part.grab - part.shopee - part.panda;
    for (const c of CHANNELS) {
      const sales = part[c.key];
      out[c.key] += conv(c, metric, sales);
      if (dv) {
        const k = `${name}${c.key}${m}`;
        const gross = sales / (1 - c.disc * (0.92 + rnd("dr" + k) * 0.16));
        const x = dv[c.key];
        x.gross += gross;
        x.discount += gross - sales;
        x.net += sales;
        x.sc += sales * c.scRate * (0.9 + rnd("sc" + k) * 0.2);
        x.sst += sales * c.sstRate * (0.97 + rnd("st" + k) * 0.06);
      }
      if (fee && fee[c.key]) {
        const f = fee[c.key];
        f.sales += sales;
        f.commission += sales * c.commission;
        f.ads += sales * c.ads * (0.75 + rnd(`ad${name}${c.key}${m}`) * 0.5);
        f.service += sales * c.service;
        f.gateway += sales * c.gateway;
        f.adjust += sales * c.adjust * (0.6 + rnd(`aj${name}${c.key}${m}`) * 0.8);
      }
    }
  }
  return out;
}

// Every outlet in the region for the period. Search, channel and sort choices are applied by the page.
export function channelView(region: "all" | Region, period: PeriodKey, metric: Metric, q = ""): ChannelView {
  const needle = q.trim().toLowerCase();
  const p = periodOf(period);
  const fee = newFees();
  const dv = newDeriv();
  const totals = zero();
  const prevTotals = p.prev ? zero() : null;
  const rows: ChannelRow[] = [];
  for (const o of OUTLETS) {
    if (region !== "all" && o.region !== region) continue;
    if (needle && !(o.name + " " + o.area).toLowerCase().includes(needle)) continue;
    const vals = over(o.name, p.ranges, metric, fee, dv);
    const total = CHANNEL_KEYS.reduce((s, k) => s + vals[k], 0);
    if (!total) continue;
    rows.push({ name: o.name, area: o.area, region: o.region, vals, total });
    for (const k of CHANNEL_KEYS) totals[k] += vals[k];
    if (prevTotals && p.prev) {
      const pv = over(o.name, p.prev, metric);
      for (const k of CHANNEL_KEYS) prevTotals[k] += pv[k];
    }
  }
  return { rows, totals, prevTotals, fees: Object.values(fee), derive: toDeriveRows(dv, fee) };
}

export type ChannelTrendPoint = { id: string; label: string; sub?: string } & Partial<Record<ChannelKey, number>>;
// Average per day in each month for the outlets given, split by channel, so a part month is not drawn as a drop.
export function channelTrend(names: string[], metric: Metric): ChannelTrendPoint[] {
  const out: ChannelTrendPoint[] = [];
  for (let m = 0; m <= LAST_M; m++) {
    const days = lastDay(m);
    const p: ChannelTrendPoint = { id: String(m), label: MONTHS[m] };
    const sum = zero();
    for (const n of names) {
      const v = over(n, [[m, 1, days]], metric);
      for (const k of CHANNEL_KEYS) sum[k] += v[k];
    }
    for (const k of CHANNEL_KEYS) p[k] = Math.round(sum[k] / days);
    out.push(p);
  }
  return out;
}

// ---- Drill-down: one outlet by channel, month by month and day by day --------------------------------------------------
export type ChannelSlice = { id: string; label: string; sub?: string; vals: Record<ChannelKey, number>; soft?: boolean };

// Every month the outlet traded, split by channel. The latest month is a part month, so it is drawn softer.
export function outletChannelMonths(name: string, metric: Metric): ChannelSlice[] {
  const out: ChannelSlice[] = [];
  for (let m = 0; m <= LAST_M; m++) {
    const vals = over(name, [[m, 1, lastDay(m)]], metric);
    if (!CHANNEL_KEYS.some((k) => vals[k] > 0)) continue;
    out.push({ id: String(m), label: MONTHS[m], sub: m === LAST_M ? `to ${lastDay(m)} ${MONTHS[m]}` : undefined, vals, soft: m === LAST_M });
  }
  return out;
}

// Every day of one month, split by channel. Weekends are drawn at full strength and weekdays softer.
export function outletChannelDays(name: string, m: number, metric: Metric): ChannelSlice[] {
  const out: ChannelSlice[] = [];
  for (let d = 1; d <= lastDay(m); d++) {
    const dow = new Date(Date.UTC(YEAR, m, d)).getUTCDay();
    out.push({ id: String(d), label: String(d), sub: DOW[dow], vals: over(name, [[m, d, d]], metric), soft: ![0, 5, 6].includes(dow) });
  }
  return out;
}

// Every day of one month for the outlets given, split by channel. Same unit as channelTrend (sales per day), so the
// year view and the month view can be read against each other.
export function channelDays(names: string[], m: number, metric: Metric): ChannelTrendPoint[] {
  const out: ChannelTrendPoint[] = [];
  for (let d = 1; d <= lastDay(m); d++) {
    const sum = zero();
    for (const n of names) {
      const v = over(n, [[m, d, d]], metric);
      for (const k of CHANNEL_KEYS) sum[k] += v[k];
    }
    const p: ChannelTrendPoint = { id: String(d), label: String(d), sub: DOW[new Date(Date.UTC(YEAR, m, d)).getUTCDay()] };
    for (const k of CHANNEL_KEYS) p[k] = Math.round(sum[k]);
    out.push(p);
  }
  return out;
}

// Sales by channel and the fees they carry, for one outlet over some days. The profit and loss page builds on this.
export function channelFeesFor(name: string, ranges: Range[]): { vals: Record<ChannelKey, number>; fee: Record<ChannelKey, FeeRow> } {
  const fee = newFees();
  const vals = over(name, ranges, "sales", fee);
  return { vals, fee };
}

const toDeriveRows = (dv: Record<ChannelKey, Deriv>, fee: Record<ChannelKey, FeeRow>): DeriveRow[] =>
  CHANNELS.map((c) => {
    const f = fee[c.key];
    return { key: c.key, ...dv[c.key], commission: f?.commission ?? 0, ads: f?.ads ?? 0, service: f?.service ?? 0, gateway: f?.gateway ?? 0, adjust: f?.adjust ?? 0 };
  });

// The derivation by channel for some outlets over some days: the same figures as the Sales by channel page.
export function deriveRowsFor(names: string[], ranges: Range[]): DeriveRow[] {
  const dv = newDeriv();
  const fee = newFees();
  for (const n of names) over(n, ranges, "sales", fee, dv);
  return toDeriveRows(dv, fee);
}

const outletCache = new Map<string, Deriv>();
// All channels of one outlet added up. Remembered, because a page asks for it once for every row it draws.
export function deriveOutlet(name: string, ranges: Range[]): Deriv {
  const key = name + JSON.stringify(ranges);
  const hit = outletCache.get(key);
  if (hit) return hit;
  const dv = newDeriv();
  over(name, ranges, "sales", undefined, dv);
  const t: Deriv = { gross: 0, discount: 0, net: 0, sc: 0, sst: 0 };
  for (const d of Object.values(dv)) {
    t.gross += d.gross;
    t.discount += d.discount;
    t.net += d.net;
    t.sc += d.sc;
    t.sst += d.sst;
  }
  outletCache.set(key, t);
  return t;
}

export type Derived = "gross" | "discount" | "sc" | "sst" | "collected";
export const DERIVED_LABEL: Record<Derived, string> = { gross: "Gross sales", discount: "Discount", sc: "Service charge", sst: "SST (tax)", collected: "Collected sales" };
// A derived measure of one outlet over some days, as a multiple of its net sales. Sales by outlet scales its net sales rows by this.
export function derivedRatio(name: string, ranges: Range[], kind: Derived): number {
  const d = deriveOutlet(name, ranges);
  if (!d.net) return 0;
  return (kind === "gross" ? d.gross : kind === "discount" ? d.discount : kind === "sc" ? d.sc : kind === "sst" ? d.sst : collectedOf(d)) / d.net;
}
