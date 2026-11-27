// SAMPLE DATA for the Food variance design. Nothing here comes from Supabase, the stock count files or the POS.
// Every figure is generated from the outlet, the item and the date, so the same click always shows the same numbers.
// It sits on the same outlets and daily sales as the other pages (overview-mock.ts). Replace the builders with queries
// later and keep the shapes.
import { DOW, LAST_D, LAST_M, MONTHS, OUTLETS, fcPct, rnd, sumDays } from "@/lib/overview-mock";
import type { Range } from "@/lib/overview-mock";
import type { Region } from "@/lib/outlet-locations";

export type Cat = "FOOD" | "PACKAGING";
export type VItem = { code: string; name: string; cat: Cat; uom: string; cost: number; usage: number; cover: number };

// usage: how much of the item is used for each RM 1,000 of sales. cover: days of stock the outlet keeps on the shelf.
export const ITEMS: VItem[] = [
  { code: "USRW00009", name: "Mozzarella Cheese", cat: "FOOD", uom: "KG", cost: 28, usage: 3.2, cover: 3 },
  { code: "USRW00192", name: "Whipping Cream", cat: "FOOD", uom: "PKT", cost: 9.5, usage: 1.6, cover: 3 },
  { code: "USRW00021", name: "Pizza Dough Ball", cat: "FOOD", uom: "PCS", cost: 1.9, usage: 38, cover: 2 },
  { code: "USRW00034", name: "Pizza Sauce", cat: "FOOD", uom: "KG", cost: 7.5, usage: 1.4, cover: 4 },
  { code: "USRW00047", name: "Pepperoni", cat: "FOOD", uom: "KG", cost: 42, usage: 0.7, cover: 4 },
  { code: "USRW00052", name: "Chicken Slices", cat: "FOOD", uom: "KG", cost: 22, usage: 0.9, cover: 3 },
  { code: "USRW00063", name: "Beef Bacon", cat: "FOOD", uom: "KG", cost: 38, usage: 0.5, cover: 4 },
  { code: "USRW00071", name: "Sausage", cat: "FOOD", uom: "KG", cost: 19, usage: 0.6, cover: 4 },
  { code: "USRW00088", name: "Tuna", cat: "FOOD", uom: "CAN", cost: 6.8, usage: 1.8, cover: 5 },
  { code: "USRW00095", name: "Mushroom", cat: "FOOD", uom: "KG", cost: 13, usage: 0.8, cover: 2 },
  { code: "USRW00104", name: "Black Olives", cat: "FOOD", uom: "CAN", cost: 8.2, usage: 0.9, cover: 5 },
  { code: "USRW00117", name: "Capsicum", cat: "FOOD", uom: "KG", cost: 9.5, usage: 0.7, cover: 2 },
  { code: "USRW00123", name: "Onion", cat: "FOOD", uom: "KG", cost: 4.5, usage: 1, cover: 3 },
  { code: "USRW00138", name: "Pineapple", cat: "FOOD", uom: "CAN", cost: 5.6, usage: 1.1, cover: 5 },
  { code: "USRW00146", name: "Flour", cat: "FOOD", uom: "KG", cost: 3.6, usage: 2.5, cover: 5 },
  { code: "USRW00159", name: "Cooking Oil", cat: "FOOD", uom: "L", cost: 7.2, usage: 0.6, cover: 5 },
  { code: "USRW00162", name: "Chicken Wings", cat: "FOOD", uom: "KG", cost: 17, usage: 0.8, cover: 3 },
  { code: "USRW00175", name: "Garlic Bread Mix", cat: "FOOD", uom: "KG", cost: 11, usage: 0.3, cover: 5 },
  { code: "USPK00011", name: 'Pizza Box 12"', cat: "PACKAGING", uom: "PCS", cost: 1.15, usage: 28, cover: 6 },
  { code: "USPK00012", name: 'Pizza Box 9"', cat: "PACKAGING", uom: "PCS", cost: 0.85, usage: 16, cover: 6 },
  { code: "USPK00024", name: "Paper Bag", cat: "PACKAGING", uom: "PCS", cost: 0.4, usage: 22, cover: 6 },
  { code: "USPK00031", name: "Sauce Sachet", cat: "PACKAGING", uom: "PCS", cost: 0.12, usage: 60, cover: 6 },
  { code: "USPK00045", name: "Napkin Pack", cat: "PACKAGING", uom: "PKT", cost: 4.2, usage: 0.5, cover: 7 },
  { code: "USPK00052", name: "Cup 16oz", cat: "PACKAGING", uom: "PCS", cost: 0.32, usage: 18, cover: 7 },
];

export type VPeriod = { key: string; label: string; prevLabel: string; ranges: Range[]; prev: Range[] };
export const VPERIODS: VPeriod[] = [
  { key: "d7", label: "Last 7 days", prevLabel: "the 7 days before", ranges: [[LAST_M, LAST_D - 6, LAST_D]], prev: [[LAST_M, LAST_D - 13, LAST_D - 7]] },
  { key: "mtd", label: `Month to date (${MONTHS[LAST_M]})`, prevLabel: "same days in Oct", ranges: [[LAST_M, 1, LAST_D]], prev: [[LAST_M - 1, 1, LAST_D]] },
  { key: "oct", label: "October 2026", prevLabel: "September", ranges: [[LAST_M - 1, 1, 31]], prev: [[LAST_M - 2, 1, 30]] },
];
export const vPeriodOf = (key: string) => VPERIODS.find((p) => p.key === key) ?? VPERIODS[1];

// A day is short of an item when the counted stock is RM 10 or more under what the system expects. Same threshold as the
// item status elsewhere in the app. Critical is RM 50 or more.
export const SHORT_RM = 10;
export const CRIT_RM = 50;
export type Pattern = "repeat" | "some" | "clear";
export const PATTERN_LABEL: Record<Pattern, string> = { repeat: "Repeated", some: "Occasional", clear: "Clear" };

export type Day = { m: number; d: number; label: string; sub: string };
const daysOf = (ranges: Range[]): Day[] => {
  const out: Day[] = [];
  for (const [m, a, b] of ranges) for (let d = a; d <= b; d++) out.push({ m, d, label: `${d} ${MONTHS[m]}`, sub: DOW[new Date(Date.UTC(2026, m, d)).getUTCDay()] });
  return out;
};

// ---- One count --------------------------------------------------------------------------------------------------------
const itemBias = ITEMS.map((it, i) => -(0.002 + rnd("ib" + it.code + i) * 0.012));
const dp = (uom: string) => (uom === "KG" || uom === "L" ? 2 : 0);

function count(oi: number, ii: number, m: number, d: number, daySales: number) {
  const o = OUTLETS[oi];
  const it = ITEMS[ii];
  const sys = Math.max(1, +((it.usage * (daySales / 1000) * it.cover) * (0.9 + rnd(`sy${o.name}${it.code}${m}-${d}`) * 0.2)).toFixed(dp(it.uom)));
  const persistent = rnd(`pl${o.name}${it.code}`) < 0.07 ? -(0.04 + rnd(`pa${o.name}${it.code}`) * 0.05) : 0;
  const outletBias = -rnd("ob" + o.name) * 0.006;
  const noise = (rnd(`nz${o.name}${it.code}${m}-${d}`) - 0.5) * 0.07;
  const spike = rnd(`sp${o.name}${it.code}${m}-${d}`);
  const pct = itemBias[ii] + outletBias + persistent + noise + (spike < 0.02 ? -0.12 : spike < 0.03 ? 0.08 : 0);
  const varq = +(sys * pct).toFixed(dp(it.uom));
  return { sys, phys: +(sys + varq).toFixed(dp(it.uom)), varq, rm: varq * it.cost };
}

// ---- Data trust: was the day's stock count, GRN and POS deduction there? ------------------------------------------------
const noCount = (oi: number, m: number, d: number) => rnd(`nc${OUTLETS[oi].name}${m}-${d}`) < 0.035;
const noGrn = (oi: number, m: number, d: number) => rnd(`ng${OUTLETS[oi].name}${m}-${d}`) < 0.06;
const noDed = (oi: number, m: number, d: number) => rnd(`nd${OUTLETS[oi].name}${m}-${d}`) < 0.05;

export type Trust = { name: string; area: string; days: number; noCount: number; noGrn: number; noDed: number; complete: number };

// ---- The grid: every outlet and item over a period --------------------------------------------------------------------------
export type Cell = {
  o: number; // outlet index
  i: number; // item index
  vals: (number | null)[]; // value of each day in RM, null where nobody counted
  net: number; // sum of the days
  short: number; // sum of the days that were under
  days: number; // days that were counted
  daysShort: number; // days short by RM 10 or more
  last: { sys: number; phys: number; varq: number } | null; // the latest count
  pattern: Pattern;
};
export type Grid = { days: Day[]; cells: Cell[]; sales: number[]; trust: Trust[] };

const cache = new Map<string, Grid>();
export function buildGrid(ranges: Range[]): Grid {
  const key = JSON.stringify(ranges);
  const hit = cache.get(key);
  if (hit) return hit;
  const days = daysOf(ranges);
  const cells: Cell[] = [];
  const sales = OUTLETS.map((o) => ranges.reduce((s, [m, a, b]) => s + sumDays(o, m, a, b), 0));
  const trust: Trust[] = OUTLETS.map((o, oi) => {
    let nc = 0, ng = 0, nd = 0, complete = 0;
    for (const { m, d } of days) {
      const a = noCount(oi, m, d), b = noGrn(oi, m, d), c = noDed(oi, m, d);
      if (a) nc++;
      if (b) ng++;
      if (c) nd++;
      if (!a && !b && !c) complete++;
    }
    return { name: o.name, area: o.area, days: days.length, noCount: nc, noGrn: ng, noDed: nd, complete };
  });
  for (let oi = 0; oi < OUTLETS.length; oi++) {
    const o = OUTLETS[oi];
    if (o.open > LAST_M) continue;
    const daySales = days.map(({ m, d }) => (m < o.open ? 0 : sumDays(o, m, d, d)));
    for (let ii = 0; ii < ITEMS.length; ii++) {
      const vals: (number | null)[] = [];
      let net = 0, short = 0, n = 0, ds = 0, last: Cell["last"] = null;
      days.forEach(({ m, d }, k) => {
        if (!daySales[k] || noCount(oi, m, d)) return void vals.push(null);
        const c = count(oi, ii, m, d, daySales[k]);
        vals.push(c.rm);
        net += c.rm;
        if (c.rm < 0) short -= c.rm;
        n++;
        if (c.rm <= -SHORT_RM) ds++;
        last = { sys: c.sys, phys: c.phys, varq: c.varq };
      });
      if (!n) continue;
      const pattern: Pattern = ds >= 3 && ds >= 0.4 * n ? "repeat" : ds >= 1 ? "some" : "clear";
      cells.push({ o: oi, i: ii, vals, net, short, days: n, daysShort: ds, last, pattern });
    }
  }
  const g = { days, cells, sales, trust };
  cache.set(key, g);
  return g;
}

export const regionOf = (oi: number): Region => OUTLETS[oi].region;
export const outletName = (oi: number) => OUTLETS[oi].name;
export const outletArea = (oi: number) => OUTLETS[oi].area;
// Food cost of an outlet over the period as a share of sales, the same figure as the Profit & loss page uses.
export function foodCostOf(oi: number, ranges: Range[]): number {
  const o = OUTLETS[oi];
  let used = 0, sales = 0;
  for (const [m, a, b] of ranges) {
    const s = sumDays(o, m, a, b);
    sales += s;
    used += (s * fcPct(o, m)) / 100;
  }
  return sales ? (used / sales) * 100 : 0;
}
