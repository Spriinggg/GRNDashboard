// SAMPLE DATA for the Labour vs sales design. Nothing here comes from a payroll report, a roster or the POS.
// Every figure is generated from the outlet and the date, so the same click always shows the same numbers. It sits on
// the same outlets and daily sales as the other pages (overview-mock.ts). Replace the builders with queries later and
// keep the shapes.
import { DOW, LAST_D, LAST_M, MONTHS, OUTLETS, hourRows, rnd, sumDays } from "@/lib/overview-mock";
import type { Profile, Range } from "@/lib/overview-mock";
import type { Region } from "@/lib/outlet-locations";

export type Role = "kitchen" | "counter" | "delivery";
export const ROLES: Role[] = ["kitchen", "counter", "delivery"];
export const ROLE_LABEL: Record<Role, string> = { kitchen: "Kitchen", counter: "Counter", delivery: "Delivery" };
export const TARGET = 25; // labour cost as a % of net sales
export const OT_HIGH = 8; // overtime as a % of hours that counts as high

// Pay for an hour of each role, before overtime, allowances and what the employer adds.
const RATE: Record<Role, number> = { kitchen: 9.6, counter: 8.8, delivery: 8.6 };
const SHIFT = 8; // hours in a shift

// How many people an outlet puts on each day, by role. It follows the size of the outlet and not the day's sales.
const crew = (o: Profile): Record<Role, number> => ({ kitchen: Math.max(3, Math.round(o.base / 780)), counter: Math.max(2, Math.round(o.base / 1000)), delivery: Math.max(1, Math.round(o.base / 1700)) });

// Share of the day's staff-hours that sit in each hour from 10am to 10pm: a lighter opening, full at lunch and dinner,
// lighter in the afternoon and at close. The plan is the same every day.
export const HOURS = Array.from({ length: 13 }, (_, i) => i + 10);
const HOUR_PLAN = [0.6, 0.6, 1, 1, 0.9, 0.7, 0.7, 0.7, 1, 1, 1, 0.9, 0.5];
const PLAN_SUM = HOUR_PLAN.reduce((a, b) => a + b, 0);

export type VPeriodKey = "d7" | "mtd" | "oct";
export type LPeriod = { key: string; label: string; prevLabel: string; ranges: Range[]; prev: Range[] };
export const LPERIODS: LPeriod[] = [
  { key: "d7", label: "Last 7 days", prevLabel: "the 7 days before", ranges: [[LAST_M, LAST_D - 6, LAST_D]], prev: [[LAST_M, LAST_D - 13, LAST_D - 7]] },
  { key: "mtd", label: `Month to date (${MONTHS[LAST_M]})`, prevLabel: "same days in Oct", ranges: [[LAST_M, 1, LAST_D]], prev: [[LAST_M - 1, 1, LAST_D]] },
  { key: "oct", label: "October 2026", prevLabel: "September", ranges: [[LAST_M - 1, 1, 31]], prev: [[LAST_M - 2, 1, 30]] },
];
export const lPeriodOf = (key: string) => LPERIODS.find((p) => p.key === key) ?? LPERIODS[1];

export type RoleDay = { hours: number; otHours: number; regular: number; ot: number; allow: number; employer: number };
export type OutletDay = { sales: number; roles: Record<Role, RoleDay> };
export type Day = { m: number; d: number; label: string; sub: string; dow: number };
export type LGrid = { days: Day[]; outlets: { o: number; days: (OutletDay | null)[] }[] };

const daysOf = (ranges: Range[]): Day[] => {
  const out: Day[] = [];
  for (const [m, a, b] of ranges) for (let d = a; d <= b; d++) {
    const dow = new Date(Date.UTC(2026, m, d)).getUTCDay();
    out.push({ m, d, label: `${d} ${MONTHS[m]}`, sub: DOW[dow], dow });
  }
  return out;
};

function dayOf(oi: number, m: number, d: number, dow: number, sales: number): OutletDay {
  const o = OUTLETS[oi];
  const base = crew(o);
  const payBias = 0.95 + rnd("pb" + o.name) * 0.13;
  const otBase = 0.03 + rnd("ot" + o.name) * 0.07;
  const busy = dow === 5 || dow === 6 ? 0.03 : 0;
  const roles = {} as Record<Role, RoleDay>;
  for (const r of ROLES) {
    const people = base[r] + (r === "kitchen" && busy && rnd(`ex${o.name}${m}-${d}`) < 0.5 ? 1 : 0);
    const hours = people * SHIFT;
    const otHours = hours * Math.max(0, otBase + busy + (rnd(`od${o.name}${r}${m}-${d}`) - 0.5) * 0.03);
    const regular = hours * RATE[r] * payBias;
    const ot = otHours * RATE[r] * payBias * 1.5;
    roles[r] = { hours, otHours, regular, ot, allow: regular * 0.05, employer: (regular + ot) * 0.14 };
  }
  return { sales, roles };
}

const cache = new Map<string, LGrid>();
export function labourGrid(ranges: Range[]): LGrid {
  const key = JSON.stringify(ranges);
  const hit = cache.get(key);
  if (hit) return hit;
  const days = daysOf(ranges);
  const outlets = OUTLETS.map((o, oi) => ({ o: oi, days: days.map(({ m, d, dow }) => (m < o.open ? null : dayOf(oi, m, d, dow, sumDays(o, m, d, d)))) }));
  const g = { days, outlets };
  cache.set(key, g);
  return g;
}

export const outletName = (oi: number) => OUTLETS[oi].name;
export const outletArea = (oi: number) => OUTLETS[oi].area;
export const regionOf = (oi: number): Region => OUTLETS[oi].region;

export type Agg = { sales: number; hours: number; otHours: number; regular: number; ot: number; allow: number; employer: number; cost: number; days: number; byRole: Record<Role, { hours: number; cost: number }> };
const zeroAgg = (): Agg => ({ sales: 0, hours: 0, otHours: 0, regular: 0, ot: 0, allow: 0, employer: 0, cost: 0, days: 0, byRole: { kitchen: { hours: 0, cost: 0 }, counter: { hours: 0, cost: 0 }, delivery: { hours: 0, cost: 0 } } });

// Add up some outlets, for the roles chosen (all roles when none). Sales are the whole outlet's sales whatever the role, so the
// labour share of a single role reads as that role's share of sales.
export function aggregate(g: LGrid, outlets: number[], roles: Role[] = ROLES): Agg {
  const a = zeroAgg();
  for (const oi of outlets) {
    for (const day of g.outlets[oi].days) {
      if (!day) continue;
      a.sales += day.sales;
      a.days++;
      for (const r of roles) {
        const x = day.roles[r];
        a.hours += x.hours;
        a.otHours += x.otHours;
        a.regular += x.regular;
        a.ot += x.ot;
        a.allow += x.allow;
        a.employer += x.employer;
        const c = x.regular + x.ot + x.allow + x.employer;
        a.cost += c;
        a.byRole[r].hours += x.hours;
        a.byRole[r].cost += c;
      }
    }
  }
  return a;
}
export const pctOf = (a: Agg) => (a.sales ? (a.cost / a.sales) * 100 : 0);
export const perHour = (a: Agg) => (a.hours ? a.sales / a.hours : 0);
export const otPct = (a: Agg) => (a.hours ? (a.otHours / a.hours) * 100 : 0);

export type DayPoint = { label: string; sub: string; cost: number; sales: number; pct: number; hours: number };
export function byDay(g: LGrid, outlets: number[], roles: Role[] = ROLES): DayPoint[] {
  return g.days.map((day, k) => {
    let cost = 0, sales = 0, hours = 0;
    for (const oi of outlets) {
      const x = g.outlets[oi].days[k];
      if (!x) continue;
      sales += x.sales;
      for (const r of roles) {
        const y = x.roles[r];
        cost += y.regular + y.ot + y.allow + y.employer;
        hours += y.hours;
      }
    }
    return { label: day.label, sub: day.sub, cost, sales, pct: sales ? (cost / sales) * 100 : 0, hours };
  });
}

export type WeekdayPoint = { label: string; cost: number; sales: number; pct: number };
// Monday first.
export function byWeekday(g: LGrid, outlets: number[], roles: Role[] = ROLES): WeekdayPoint[] {
  const order = [1, 2, 3, 4, 5, 6, 0];
  const t = order.map(() => ({ cost: 0, sales: 0 }));
  g.days.forEach((day, k) => {
    const idx = order.indexOf(day.dow);
    for (const oi of outlets) {
      const x = g.outlets[oi].days[k];
      if (!x) continue;
      t[idx].sales += x.sales;
      for (const r of roles) {
        const y = x.roles[r];
        t[idx].cost += y.regular + y.ot + y.allow + y.employer;
      }
    }
  });
  return order.map((dow, i) => ({ label: DOW[dow], cost: t[i].cost, sales: t[i].sales, pct: t[i].sales ? (t[i].cost / t[i].sales) * 100 : 0 }));
}

export type HourPoint = { label: string; sales: number; staff: number; perStaff: number; verdict: "short" | "even" | "many" };
const hourCache = new Map<string, number[]>();
// The average sales in each hour of the day for one outlet over the period, the same sample hours as Sales by outlet.
function hourSales(oi: number, ranges: Range[]): number[] {
  const key = oi + JSON.stringify(ranges);
  const hit = hourCache.get(key);
  if (hit) return hit;
  const o = OUTLETS[oi];
  const sums = HOURS.map(() => 0);
  let n = 0;
  for (const [m, a, b] of ranges) for (let d = a; d <= b; d++) {
    if (m < o.open) continue;
    hourRows(o.name, m, d, "sales").forEach((r, i) => (sums[i] += r.value));
    n++;
  }
  const avg = sums.map((s) => (n ? s / n : 0));
  hourCache.set(key, avg);
  return avg;
}

// Per outlet, an average day: the sales in each hour and the staff on shift in it. Where one person serves far more sales
// than usual the hour is short of staff, and where far fewer there are too many.
export function byHour(g: LGrid, ranges: Range[], outlets: number[], roles: Role[] = ROLES): HourPoint[] {
  const n = outlets.length || 1;
  const sales = HOURS.map(() => 0);
  let staffHours = 0;
  for (const oi of outlets) {
    hourSales(oi, ranges).forEach((v, i) => (sales[i] += v));
    const days = g.outlets[oi].days.filter(Boolean) as OutletDay[];
    const avgHours = days.length ? days.reduce((s, x) => s + roles.reduce((a, r) => a + x.roles[r].hours, 0), 0) / days.length : 0;
    staffHours += avgHours;
  }
  const staffPerHour = HOUR_PLAN.map((f) => ((staffHours / n) * f) / PLAN_SUM);
  const sPer = sales.map((s, i) => (staffPerHour[i] ? s / n / staffPerHour[i] : 0));
  const mean = sPer.reduce((a, b) => a + b, 0) / sPer.length || 1;
  return HOURS.map((h, i) => ({ label: h === 12 ? "12pm" : h > 12 ? `${h - 12}pm` : `${h}am`, sales: sales[i] / n, staff: staffPerHour[i], perStaff: sPer[i], verdict: sPer[i] > mean * 1.3 ? "short" : sPer[i] < mean * 0.7 ? "many" : "even" }));
}
