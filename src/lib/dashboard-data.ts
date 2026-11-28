// The figures of the Dashboard overview: one short summary for each page, for the dates and outlets chosen.
// Sales, channels, Profit & loss, Food variance, Labour and Treeams are built from the same SAMPLE data as their own pages
// (the *-mock files), so a figure on the Dashboard agrees with the page it links to. Count & GRN, Outlets and Uploads
// use the real files and are built in the page. Replace the sample builders with queries when the real reports exist.
import { CHANNEL_KEYS } from "@/lib/channel-mock";
import type { ChannelKey } from "@/lib/channel-mock";
import { fromIso, toIso } from "@/lib/date-span";
import type { DateSpan } from "@/lib/date-span";
import { TARGET as LABOUR_TARGET, byDay as labourByDay, labourGrid, aggregate as labourAgg, otPct, pctOf as labourPct, perHour } from "@/lib/labour-mock";
import { LAST_D, LAST_M, MONTHS, OUTLETS, dim, sumDays } from "@/lib/overview-mock";
import type { Range } from "@/lib/overview-mock";
import { addPnl, grossOf, marginOf, pnlOf } from "@/lib/pnl-mock";
import type { Pnl } from "@/lib/pnl-mock";
import { CTYPES, CTYPE_LABEL, TARGET as TREAMS_TARGET, aggregate as treamsAgg, pctOf as treamsPct, treamsGrid } from "@/lib/treeams-mock";
import type { CType } from "@/lib/treeams-mock";
import { ITEMS, buildGrid } from "@/lib/variance-mock";

// Sample data covers 1 Sep to the latest day. A longer range would make the sample builders slow for no gain.
export const SAMPLE_MIN = new Date(2026, 8, 1);
export const SAMPLE_MAX = new Date(2026, LAST_M, LAST_D);
const YEAR_START = new Date(2026, 0, 1);
// Month to date, the dates the Dashboard opens with and the alerts in the top bar use.
export const MTD_SPAN: DateSpan = { from: toIso(new Date(2026, LAST_M, 1)), to: toIso(SAMPLE_MAX) };

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const daysBetween = (a: Date, b: Date) => Math.round((dayStart(b).getTime() - dayStart(a).getTime()) / 86_400_000) + 1;

// The ranges the sample builders take. A span is cut to the days that have data and split by month.
export function spanToRanges(s: DateSpan): Range[] {
  if (!s.from || !s.to) return [];
  const a = fromIso(s.from);
  const b = fromIso(s.to);
  const start = a < YEAR_START ? YEAR_START : a;
  const end = b > SAMPLE_MAX ? SAMPLE_MAX : b;
  if (start > end || start.getFullYear() !== 2026 || end.getFullYear() !== 2026) return [];
  const out: Range[] = [];
  for (let m = start.getMonth(); m <= end.getMonth(); m++) out.push([m, m === start.getMonth() ? start.getDate() : 1, m === end.getMonth() ? end.getDate() : dim(m)]);
  return out;
}

// The same number of days, ending the day before the span starts. Null when that would reach back before the data.
export function previousSpan(s: DateSpan): DateSpan | null {
  if (!s.from || !s.to) return null;
  const a = fromIso(s.from);
  const n = daysBetween(a, fromIso(s.to));
  const to = addDays(a, -1);
  const from = addDays(to, -(n - 1));
  return from < YEAR_START ? null : { from: toIso(from), to: toIso(to) };
}

export const spanDays = (s: DateSpan) => (s.from && s.to ? daysBetween(fromIso(s.from), fromIso(s.to)) : 0);

const change = (now: number, before: number | null) => (before ? now / before - 1 : null);

export type Overview = {
  days: number;
  outlets: number;
  hasPrev: boolean;
  sales: { net: number; delta: number | null; daily: { label: string; value: number }[]; top: { name: string; area: string; net: number }[] };
  channels: { key: ChannelKey; net: number; share: number }[];
  pnl: { gross: number; margin: number; marginPts: number | null; fees: number; food: number; feesPct: number; foodPct: number };
  food: { short: number; shortPct: number; delta: number | null; repeated: number; outletsWithRepeat: number; items: { name: string; short: number }[]; outlets: { name: string; short: number }[] };
  labour: { pct: number; ptsVsBefore: number | null; over: number; of: number; ot: number; perHour: number; daily: { label: string; pct: number }[] };
  treeams: { pct: number; ptsVsBefore: number | null; under: number; of: number; notStarted: number; byType: { type: CType; label: string; pct: number }[] };
};

// `pool` is the outlets the filters let through, as positions in OUTLETS.
export function buildOverview(span: DateSpan, pool: number[]): Overview {
  const ranges = spanToRanges(span);
  const prevSpan = previousSpan(span);
  const prev = prevSpan ? spanToRanges(prevSpan) : [];
  const hasPrev = prev.length > 0;
  const names = pool.map((o) => OUTLETS[o].name);

  // Profit and loss, sales and channels share one pass over the outlets.
  let tot: Pnl | null = null;
  let totPrev: Pnl | null = null;
  const per = names.map((n) => {
    const p = pnlOf(n, ranges);
    tot = tot ? addPnl(tot, p) : p;
    if (hasPrev) {
      const q = pnlOf(n, prev);
      totPrev = totPrev ? addPnl(totPrev, q) : q;
    }
    return { name: n, p };
  });
  const total = tot as Pnl | null;
  const before = totPrev as Pnl | null;
  const net = total?.sales ?? 0;
  const gross = total ? grossOf(total, "used") : 0;
  const margin = total ? marginOf(total, "used") * 100 : 0;
  const marginBefore = before ? marginOf(before, "used") * 100 : null;

  // Net sales a day, for the line.
  const daily: { label: string; value: number }[] = [];
  for (const [m, a, b] of ranges) for (let d = a; d <= b; d++) daily.push({ label: `${d} ${MONTHS[m]}`, value: pool.reduce((s, o) => s + sumDays(OUTLETS[o], m, d, d), 0) });

  const top = [...per].sort((x, y) => y.p.sales - x.p.sales).slice(0, 3).map((x) => ({ name: x.name, area: OUTLETS.find((o) => o.name === x.name)!.area, net: x.p.sales }));
  const channels = CHANNEL_KEYS.map((key) => ({ key, net: total?.byChannel[key] ?? 0, share: net ? ((total?.byChannel[key] ?? 0) / net) * 100 : 0 })).sort((a, b) => b.net - a.net);

  // Food variance over the same dates.
  const poolSet = new Set(pool);
  const grid = buildGrid(ranges);
  const cells = grid.cells.filter((c) => poolSet.has(c.o));
  const short = cells.reduce((s, c) => s + c.short, 0);
  const shortBefore = hasPrev ? buildGrid(prev).cells.filter((c) => poolSet.has(c.o)).reduce((s, c) => s + c.short, 0) : null;
  const repeat = cells.filter((c) => c.pattern === "repeat");
  const byItem = new Map<number, number>();
  const byOutlet = new Map<number, number>();
  for (const c of cells) {
    byItem.set(c.i, (byItem.get(c.i) ?? 0) + c.short);
    byOutlet.set(c.o, (byOutlet.get(c.o) ?? 0) + c.short);
  }
  const rank = (m: Map<number, number>, name: (k: number) => string) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => ({ name: name(k), short: v }));

  // Labour and Treeams: the outlet's own share, so the count of outlets over the target is real for these dates.
  const lg = labourGrid(ranges);
  const la = labourAgg(lg, pool);
  const lb = hasPrev ? labourAgg(labourGrid(prev), pool) : null;
  const overLabour = pool.filter((o) => labourPct(labourAgg(lg, [o])) > LABOUR_TARGET).length;

  const tg = treamsGrid(ranges);
  const ta = treamsAgg(tg, pool);
  const tb = hasPrev ? treamsAgg(treamsGrid(prev), pool) : null;
  const underTreams = pool.filter((o) => treamsPct(treamsAgg(tg, [o])) < TREAMS_TARGET).length;

  return {
    days: spanDaysOf(ranges),
    outlets: pool.length,
    hasPrev,
    sales: { net, delta: change(net, before?.sales ?? null), daily, top },
    channels,
    pnl: { gross, margin, marginPts: marginBefore === null ? null : margin - marginBefore, fees: total?.fees.total ?? 0, food: total?.used ?? 0, feesPct: net ? ((total?.fees.total ?? 0) / net) * 100 : 0, foodPct: net ? ((total?.used ?? 0) / net) * 100 : 0 },
    food: { short, shortPct: net ? (short / net) * 100 : 0, delta: change(short, shortBefore), repeated: repeat.length, outletsWithRepeat: new Set(repeat.map((c) => c.o)).size, items: rank(byItem, (k) => ITEMS[k].name), outlets: rank(byOutlet, (k) => OUTLETS[k].name) },
    labour: { pct: labourPct(la), ptsVsBefore: lb ? labourPct(la) - labourPct(lb) : null, over: overLabour, of: pool.length, ot: otPct(la), perHour: perHour(la), daily: labourByDay(lg, pool).map((d) => ({ label: d.label, pct: d.pct })) },
    treeams: { pct: treamsPct(ta), ptsVsBefore: tb ? treamsPct(ta) - treamsPct(tb) : null, under: underTreams, of: pool.length, notStarted: ta.notStarted, byType: CTYPES.map((t) => ({ type: t, label: CTYPE_LABEL[t], pct: treamsPct(ta.byType[t]) })) },
  };
}

const spanDaysOf = (ranges: Range[]) => ranges.reduce((s, [, a, b]) => s + (b - a + 1), 0);

// One figure for each outlet, for every outlet and not only those the filters let through, so the map can draw them all.
export type OutletMetric = { o: number; name: string; open: boolean; sales: number; short: number; shortPct: number; labour: number; treeams: number };
const metricCache = new Map<string, OutletMetric[]>();
export function outletMetrics(span: DateSpan): OutletMetric[] {
  const key = span.from + "|" + span.to;
  const hit = metricCache.get(key);
  if (hit) return hit;
  const ranges = spanToRanges(span);
  const shortBy = new Map<number, number>();
  for (const c of buildGrid(ranges).cells) shortBy.set(c.o, (shortBy.get(c.o) ?? 0) + c.short);
  const lg = labourGrid(ranges);
  const tg = treamsGrid(ranges);
  const out = OUTLETS.map((o, i) => {
    const sales = pnlOf(o.name, ranges).sales;
    const short = shortBy.get(i) ?? 0;
    return { o: i, name: o.name, open: sales > 0, sales, short, shortPct: sales ? (short / sales) * 100 : 0, labour: labourPct(labourAgg(lg, [i])), treeams: treamsPct(treamsAgg(tg, [i])) };
  });
  metricCache.set(key, out);
  return out;
}
