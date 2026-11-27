// SAMPLE DATA for the Overview drill-down design. Nothing here comes from Supabase or from real POS files.
// Every figure is generated from the outlet name and the date, so the same click always shows the same numbers.
// When the backend is ready, replace the row builders at the bottom with queries and keep the Row shape.
import { outletLocations, type Region } from "@/lib/outlet-locations";

export type Metric = "sales" | "pizzas";
export type Level = "network" | "outlet" | "month" | "day";
export type PeriodKey = string; // "mtd", "ytd" or a month such as "m9" for October

export const YEAR = 2026;
export const LAST_M = 10; // November (0-based), the latest month with data
export const LAST_D = 26; // data runs to 26 Nov
export const IDEAL_FC = 30; // ideal food cost, % of sales
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const REGION_LABEL: Record<Region, string> = { klang: "Klang Valley", north: "North", south: "South" };

const HOURS = Array.from({ length: 13 }, (_, i) => i + 10); // 10am to 10pm
export const hourLabel = (h: number) => (h === 12 ? "12pm" : h > 12 ? `${h - 12}pm` : `${h}am`);

// A small deterministic random number in [0, 1) for a given text.
export function rnd(s: string): number {
  let x = 2166136261;
  for (let i = 0; i < s.length; i++) {
    x ^= s.charCodeAt(i);
    x = Math.imul(x, 16777619);
  }
  x ^= x >>> 13;
  x = Math.imul(x, 0x5bd1e995);
  x ^= x >>> 15;
  return (x >>> 0) / 4294967296;
}

export type Profile = { name: string; area: string; region: Region; base: number; price: number; open: number; fcBias: number };
export const OUTLETS: Profile[] = outletLocations.map((l) => ({
  name: l.name,
  area: l.area,
  region: l.region,
  base: 1700 + rnd("b" + l.name) * 3100, // typical weekday sales in RM
  price: 16.5 + rnd("p" + l.name) * 3, // average RM per pizza
  open: rnd("o" + l.name) < 0.14 ? 2 + Math.floor(rnd("om" + l.name) * 7) : 0, // a few outlets opened during the year
  fcBias: (rnd("f" + l.name) - 0.5) * 5,
}));
const byName = (n: string) => OUTLETS.find((o) => o.name === n)!;

const SEASON = [0.96, 0.92, 1.1, 1.02, 1, 0.98, 0.97, 1, 1.03, 1.04, 1.08, 1.1];
const DOW_F = [1.15, 0.85, 0.85, 0.9, 0.95, 1.2, 1.35];
const PROFILE = [2, 5, 10, 11, 7, 4, 4, 7, 11, 13, 11, 7, 3]; // share of the day by hour: lunch and dinner peaks
const WEEKEND_ADJ = [1, 1, 1.2, 1.25, 1.15, 1, 1, 1, 1.05, 1.1, 1.1, 1, 1];

export const dim = (m: number) => new Date(Date.UTC(YEAR, m + 1, 0)).getUTCDate();
export const lastDay = (m: number) => (m === LAST_M ? LAST_D : dim(m));
const dowOf = (m: number, d: number) => new Date(Date.UTC(YEAR, m, d)).getUTCDay();
export const dayLong = (m: number, d: number) => `${DOW[dowOf(m, d)]} ${d} ${MONTHS[m]}`;

function daySales(o: Profile, m: number, d: number): number {
  if (m < o.open) return 0;
  const ramp = m === o.open ? 0.7 : 1;
  return Math.round(o.base * DOW_F[dowOf(m, d)] * SEASON[m] * (1 + m * 0.012) * ramp * (0.86 + rnd(`d${o.name}${m}-${d}`) * 0.28));
}

const memo = new Map<string, number>();
export function sumDays(o: Profile, m: number, d1: number, d2: number): number {
  const k = `${o.name}|${m}|${d1}|${d2}`;
  let v = memo.get(k);
  if (v === undefined) {
    v = 0;
    for (let d = d1; d <= d2; d++) v += daySales(o, m, d);
    memo.set(k, v);
  }
  return v;
}

export const fcPct = (o: Profile, m: number) => +(29.5 + (rnd(`fc${o.name}${m}`) - 0.5) * 3 + o.fcBias).toFixed(1);
const conv = (o: Profile, metric: Metric, sales: number) => (metric === "sales" ? sales : Math.round(sales / o.price));

function hourSales(o: Profile, m: number, d: number): number[] {
  const total = daySales(o, m, d);
  const weekend = [0, 5, 6].includes(dowOf(m, d));
  const w = HOURS.map((h, i) => PROFILE[i] * (weekend ? WEEKEND_ADJ[i] : 1) * (0.82 + rnd(`h${o.name}${m}-${d}-${h}`) * 0.36));
  const sum = w.reduce((a, b) => a + b, 0);
  const out = w.map((x) => Math.floor((total * x) / sum));
  out[w.indexOf(Math.max(...w))] += total - out.reduce((a, b) => a + b, 0);
  return out;
}

// ---- Periods for the network view -------------------------------------------------------------------------------
export type Range = [m: number, d1: number, d2: number];
export type Period = { key: PeriodKey; label: string; prevLabel: string; ranges: Range[]; prev: Range[] | null };
const whole = (m: number): Range => [m, 1, lastDay(m)];
// Month to date, year to date, then each finished month, newest first.
export const PERIODS: Period[] = [
  { key: "mtd", label: `Month to date (${MONTHS[LAST_M]})`, prevLabel: "same days in Oct", ranges: [[LAST_M, 1, LAST_D]], prev: [[LAST_M - 1, 1, LAST_D]] },
  { key: "ytd", label: "Year to date", prevLabel: "", ranges: Array.from({ length: LAST_M + 1 }, (_, m) => whole(m)), prev: null },
  ...Array.from({ length: LAST_M }, (_, i): Period => {
    const m = LAST_M - 1 - i;
    return { key: `m${m}`, label: `${MONTHS[m]} ${YEAR}`, prevLabel: m > 0 ? MONTHS[m - 1] : "", ranges: [whole(m)], prev: m > 0 ? [whole(m - 1)] : null };
  }),
];
export const periodOf = (key: PeriodKey): Period => PERIODS.find((p) => p.key === key) ?? PERIODS[0];

const rangeValue = (o: Profile, ranges: Range[], metric: Metric) => ranges.reduce((s, [m, a, b]) => s + conv(o, metric, sumDays(o, m, a, b)), 0);
function rangeFc(o: Profile, ranges: Range[]): number | null {
  let w = 0, s = 0;
  for (const [m, a, b] of ranges) {
    const v = sumDays(o, m, a, b);
    w += v;
    s += v * fcPct(o, m);
  }
  return w ? +(s / w).toFixed(1) : null;
}

// ---- Rows the page draws ----------------------------------------------------------------------------------------
export type Row = {
  key: string;
  label: string;
  sub?: string;
  value: number;
  delta: number | null; // change against the comparison named by the page (a fraction, 0.04 = +4%)
  fc: number | null; // food cost, % of sales
  share: number; // 0 to 1 of the total on screen
  strong: boolean; // drawn at full strength; the rest are softer
};

function finish(rows: Omit<Row, "share">[]): Row[] {
  const total = rows.reduce((s, r) => s + r.value, 0) || 1;
  return rows.map((r) => ({ ...r, share: r.value / total }));
}
const change = (v: number, p: number) => (p > 0 ? (v - p) / p : null);

export function networkRows(region: "all" | Region, period: PeriodKey, metric: Metric): Row[] {
  const p = periodOf(period);
  const rows = OUTLETS.filter((o) => region === "all" || o.region === region).map((o) => {
    const value = rangeValue(o, p.ranges, metric);
    const prev = p.prev ? rangeValue(o, p.prev, metric) : 0;
    return { key: o.name, label: o.name, sub: o.area, value, delta: p.prev ? change(value, prev) : null, fc: rangeFc(o, p.ranges), strong: true };
  });
  return finish(rows.filter((r) => r.value > 0).sort((a, b) => b.value - a.value));
}

export function outletRows(name: string, metric: Metric): Row[] {
  const o = byName(name);
  const rows: Omit<Row, "share">[] = [];
  for (let m = Math.max(o.open, 0); m <= LAST_M; m++) {
    const days = lastDay(m);
    const v = sumDays(o, m, 1, days);
    const pv = m - 1 >= o.open ? sumDays(o, m - 1, 1, lastDay(m - 1)) : 0;
    rows.push({
      key: String(m),
      label: MONTHS[m],
      sub: m === LAST_M ? `to ${LAST_D} Nov` : undefined,
      value: conv(o, metric, v),
      delta: pv > 0 ? change(v / days, pv / lastDay(m - 1)) : null, // daily average, so a part month is fair
      fc: fcPct(o, m),
      strong: m !== LAST_M,
    });
  }
  return finish(rows);
}

export function monthRows(name: string, m: number, metric: Metric): Row[] {
  const o = byName(name);
  const rows: Omit<Row, "share">[] = [];
  for (let d = 1; d <= lastDay(m); d++) {
    const v = daySales(o, m, d);
    const pv = d > 7 ? daySales(o, m, d - 7) : 0;
    rows.push({ key: String(d), label: String(d), sub: DOW[dowOf(m, d)], value: conv(o, metric, v), delta: change(v, pv), fc: null, strong: [0, 5, 6].includes(dowOf(m, d)) });
  }
  return finish(rows);
}

export function hourRows(name: string, m: number, d: number, metric: Metric): Row[] {
  const o = byName(name);
  const vals = hourSales(o, m, d);
  const peak = [...vals].sort((a, b) => b - a)[2] ?? 0;
  return finish(HOURS.map((h, i) => ({ key: String(h), label: hourLabel(h), value: conv(o, metric, vals[i]), delta: null, fc: null, strong: vals[i] >= peak })));
}

// ---- Trend by month, for the line chart ---------------------------------------------------------------------------
export type TrendPoint = { label: string; total: number; [outlet: string]: number | string | null };

// Average per day for each month, so a part month (November) is not drawn as a drop. null before an outlet opened.
export function trendRows(names: string[], metric: Metric): TrendPoint[] {
  const out: TrendPoint[] = [];
  for (let m = 0; m <= LAST_M; m++) {
    const days = lastDay(m);
    const p: TrendPoint = { label: MONTHS[m], total: 0 };
    let total = 0;
    for (const n of names) {
      const o = byName(n);
      const v = m < o.open ? null : Math.round(conv(o, metric, sumDays(o, m, 1, days)) / days);
      p[n] = v;
      total += v ?? 0;
    }
    p.total = total;
    out.push(p);
  }
  return out;
}
