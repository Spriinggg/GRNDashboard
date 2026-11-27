// SAMPLE DATA for the Sales by channel design. Nothing here comes from Supabase, POS or the delivery apps.
// Built on the same outlets and daily sales as overview-mock.ts, then split into channels with fixed rules,
// so every outlet and period shows the same numbers each time. Replace the builders with queries later.
import { DOW, LAST_M, MONTHS, OUTLETS, YEAR, lastDay, periodOf, rnd, sumDays } from "@/lib/overview-mock";
import type { Metric, PeriodKey, Range } from "@/lib/overview-mock";
import type { Region } from "@/lib/outlet-locations";

export type ChannelKey = "walkin" | "app" | "grab" | "shopee" | "panda";
export type Channel = { key: ChannelKey; label: string; short: string; logo: string; named: boolean; color: string; aov: number; platform: boolean; share: number; growth: number; commission: number; ads: number; service: number; gateway: number; adjust: number };

// share: typical part of sales. growth: how the share drifts through the year. Fee rates are a share of the channel's own sales:
// commission, advertising and service fee for the delivery platforms, payment gateway for the US Pizza app, and small
// adjustments or credits. These rates are made up for the design.
export const CHANNELS: Channel[] = [
  { key: "walkin", label: "POS (Zeoniq)", short: "POS", logo: "/logos/zeoniq.png", named: true, color: "var(--muted-foreground)", aov: 22, platform: false, share: 0.52, growth: -0.006, commission: 0, ads: 0, service: 0, gateway: 0, adjust: 0 },
  { key: "app", label: "US Pizza App", short: "App", logo: "/logo.svg", named: false, color: "var(--primary)", aov: 31, platform: false, share: 0.08, growth: 0.03, commission: 0, ads: 0, service: 0, gateway: 0.015, adjust: 0 },
  { key: "grab", label: "GrabFood", short: "Grab", logo: "/logos/grab.svg", named: true, color: "#2f9e44", aov: 36, platform: true, share: 0.18, growth: 0.012, commission: 0.25, ads: 0.04, service: 0.02, gateway: 0, adjust: 0.005 },
  { key: "shopee", label: "ShopeeFood", short: "Shopee", logo: "/logos/shopee.svg", named: true, color: "#f08c00", aov: 34, platform: true, share: 0.12, growth: 0.015, commission: 0.2, ads: 0.05, service: 0.03, gateway: 0, adjust: 0.004 },
  { key: "panda", label: "FoodPanda", short: "Panda", logo: "/logos/foodpanda.svg", named: true, color: "#e64980", aov: 37, platform: true, share: 0.1, growth: 0.008, commission: 0.27, ads: 0.06, service: 0.02, gateway: 0, adjust: 0.008 },
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
export type ChannelView = { rows: ChannelRow[]; totals: Vals; prevTotals: Vals | null; fees: FeeRow[] };

// An empty fee record for every channel that carries fees (the delivery platforms and the payment gateway of the app).
const newFees = () => Object.fromEntries(CHANNELS.filter((c) => c.commission + c.ads + c.service + c.gateway + c.adjust > 0).map((c) => [c.key, { key: c.key, sales: 0, commission: 0, ads: 0, service: 0, gateway: 0, adjust: 0 }])) as Record<ChannelKey, FeeRow>;

function over(name: string, ranges: Range[], metric: Metric, fee?: Record<ChannelKey, FeeRow>): Vals {
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
  const totals = zero();
  const prevTotals = p.prev ? zero() : null;
  const rows: ChannelRow[] = [];
  for (const o of OUTLETS) {
    if (region !== "all" && o.region !== region) continue;
    if (needle && !(o.name + " " + o.area).toLowerCase().includes(needle)) continue;
    const vals = over(o.name, p.ranges, metric, fee);
    const total = CHANNEL_KEYS.reduce((s, k) => s + vals[k], 0);
    if (!total) continue;
    rows.push({ name: o.name, area: o.area, region: o.region, vals, total });
    for (const k of CHANNEL_KEYS) totals[k] += vals[k];
    if (prevTotals && p.prev) {
      const pv = over(o.name, p.prev, metric);
      for (const k of CHANNEL_KEYS) prevTotals[k] += pv[k];
    }
  }
  return { rows, totals, prevTotals, fees: Object.values(fee) };
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
