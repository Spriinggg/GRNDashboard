// SAMPLE DATA for the Treeams design. Nothing here comes from a Treeams report: the real upload only gives, for each outlet
// and checklist type, how many tasks were done out of how many were expected, with no day, no task name and no time.
// Every figure is generated from the outlet, the checklist and the date, so the same click always shows the same numbers.
// It sits on the same outlets and dates as the other pages (overview-mock.ts). Replace the builders with queries later and
// keep the shapes.
import { DOW, LAST_D, LAST_M, MONTHS, OUTLETS, rnd } from "@/lib/overview-mock";
import type { Range } from "@/lib/overview-mock";
import type { Region } from "@/lib/outlet-locations";

export type CType = "opening" | "closing" | "manager" | "cash";
export const CTYPES: CType[] = ["opening", "closing", "manager", "cash"];
export const CTYPE_LABEL: Record<CType, string> = { opening: "Opening", closing: "Closing", manager: "Manager", cash: "Cash" };
export const TARGET = 90; // % of tasks done

// Each checklist is a list of tasks. `w` is how often a task is the one left undone, against the average of 1: a photo of the
// closed store is skipped far more often than unlocking the door.
type Task = { name: string; w: number };
export const TASKS: Record<CType, Task[]> = {
  opening: [
    { name: "Unlock and switch off the alarm", w: 0.4 },
    { name: "Check chiller and freezer temperatures", w: 1.2 },
    { name: "Switch on the ovens and warm them up", w: 0.5 },
    { name: "Count the cash float", w: 0.8 },
    { name: "Sanitise the prep tables", w: 1.0 },
    { name: "Check dough and sauce stock", w: 1.3 },
    { name: "Check box and packaging stock", w: 1.1 },
    { name: "Test the POS and card machine", w: 0.6 },
    { name: "Turn on the delivery tablets", w: 0.9 },
    { name: "Check the dining area and toilet", w: 1.4 },
    { name: "Check uniform and handwashing", w: 1.5 },
    { name: "Photo of the store ready to open", w: 1.9 },
  ],
  closing: [
    { name: "Clean the ovens and trays", w: 1.5 },
    { name: "Wash and sanitise the prep tables", w: 1.0 },
    { name: "Clean the floors and drains", w: 1.2 },
    { name: "Empty the bins and take out rubbish", w: 0.8 },
    { name: "Wrap and label leftover toppings", w: 1.3 },
    { name: "Record the day's wastage", w: 1.9 },
    { name: "Do the closing stock count", w: 1.7 },
    { name: "Switch off the gas and equipment", w: 0.5 },
    { name: "Switch off the delivery tablets", w: 0.9 },
    { name: "Check the chiller temperature", w: 1.0 },
    { name: "Cash up and seal the deposit bag", w: 0.7 },
    { name: "Lock up and set the alarm", w: 0.4 },
    { name: "Photo of the closed store", w: 2.0 },
    { name: "Manager sign-off", w: 1.1 },
  ],
  manager: [
    { name: "Walk the floor every hour", w: 1.0 },
    { name: "Check the order queue and delivery times", w: 1.1 },
    { name: "Check who is on shift and on break", w: 0.9 },
    { name: "Taste and check three pizzas", w: 1.4 },
    { name: "Check the dining area is clean", w: 1.2 },
    { name: "Answer customer complaints", w: 0.7 },
    { name: "Check stock for the evening rush", w: 1.3 },
    { name: "Send the shift report", w: 1.5 },
  ],
  cash: [
    { name: "Count the opening float", w: 0.7 },
    { name: "Record cash sales at midday", w: 1.0 },
    { name: "Count the till at shift change", w: 1.2 },
    { name: "Record cash paid out", w: 1.4 },
    { name: "Count the closing cash", w: 0.8 },
    { name: "Match the cash to the POS report", w: 1.6 },
  ],
};

// How likely each checklist is to have tasks left undone, against the average.
const TYPE_MISS: Record<CType, number> = { opening: 0.8, closing: 1.3, manager: 1.0, cash: 0.7 };

export type TPeriod = { key: string; label: string; prevLabel: string; ranges: Range[] };
export const TPERIODS: TPeriod[] = [
  { key: "d7", label: "Last 7 days", prevLabel: "the 7 days before", ranges: [[LAST_M, LAST_D - 6, LAST_D]] },
  { key: "mtd", label: `Month to date (${MONTHS[LAST_M]})`, prevLabel: "the month before", ranges: [[LAST_M, 1, LAST_D]] },
  { key: "oct", label: "October 2026", prevLabel: "September", ranges: [[LAST_M - 1, 1, 31]] },
];
export const tPeriodOf = (key: string) => TPERIODS.find((p) => p.key === key) ?? TPERIODS[1];

// One checklist on one day at one outlet. `missed` is a bit mask of the tasks left undone (bit i is task i).
export type Cell = { done: number; exp: number; late: boolean; missed: number };
export type Day = { m: number; d: number; label: string; sub: string; dow: number };
export type TGrid = { days: Day[]; outlets: { o: number; days: (Record<CType, Cell> | null)[] }[] };

const daysOf = (ranges: Range[]): Day[] => {
  const out: Day[] = [];
  for (const [m, a, b] of ranges)
    for (let d = a; d <= b; d++) {
      const dow = new Date(Date.UTC(2026, m, d)).getUTCDay();
      out.push({ m, d, label: `${d} ${MONTHS[m]}`, sub: DOW[dow], dow });
    }
  return out;
};

// How well an outlet keeps its checklists: most are good, a few are poor.
const discipline = (name: string) => 0.985 - Math.pow(rnd("td" + name), 2.4) * 0.3;

function cellOf(name: string, t: CType, m: number, d: number, dow: number): Cell {
  const tasks = TASKS[t];
  const gap = (1 - discipline(name)) * 0.8 * TYPE_MISS[t] * (t === "closing" && (dow === 5 || dow === 6) ? 1.4 : 1);
  const key = `${name}|${t}|${m}-${d}`;
  const all = (1 << tasks.length) - 1;
  // Some days the checklist is not started at all, much more at the poor outlets.
  if (rnd("sk" + key) < gap * 0.22) return { done: 0, exp: tasks.length, late: false, missed: all };
  let missed = 0;
  tasks.forEach((k, i) => {
    if (rnd(`ms${key}|${i}`) < Math.min(0.9, gap * k.w)) missed |= 1 << i;
  });
  const done = tasks.length - bitCount(missed);
  return { done, exp: tasks.length, late: done > 0 && rnd("lt" + key) < 0.05 + (1 - discipline(name)) * 0.7, missed };
}
const bitCount = (n: number) => {
  let c = 0;
  for (; n; n &= n - 1) c++;
  return c;
};

const cache = new Map<string, TGrid>();
export function treamsGrid(ranges: Range[]): TGrid {
  const key = JSON.stringify(ranges);
  const hit = cache.get(key);
  if (hit) return hit;
  const days = daysOf(ranges);
  const outlets = OUTLETS.map((o, oi) => ({
    o: oi,
    days: days.map(({ m, d, dow }) => {
      if (m < o.open) return null;
      const c = {} as Record<CType, Cell>;
      for (const t of CTYPES) c[t] = cellOf(o.name, t, m, d, dow);
      return c;
    }),
  }));
  const g = { days, outlets };
  cache.set(key, g);
  return g;
}

export const outletName = (oi: number) => OUTLETS[oi].name;
export const outletArea = (oi: number) => OUTLETS[oi].area;
export const regionOf = (oi: number): Region => OUTLETS[oi].region;

export type Agg = { done: number; exp: number; cells: number; notStarted: number; late: number; days: number; byType: Record<CType, { done: number; exp: number; notStarted: number }> };
const zeroAgg = (): Agg => ({ done: 0, exp: 0, cells: 0, notStarted: 0, late: 0, days: 0, byType: { opening: { done: 0, exp: 0, notStarted: 0 }, closing: { done: 0, exp: 0, notStarted: 0 }, manager: { done: 0, exp: 0, notStarted: 0 }, cash: { done: 0, exp: 0, notStarted: 0 } } });

// Add up some outlets for the checklists chosen (all of them when none).
export function aggregate(g: TGrid, outlets: number[], types: CType[] = CTYPES): Agg {
  const a = zeroAgg();
  for (const oi of outlets)
    for (const day of g.outlets[oi].days) {
      if (!day) continue;
      a.days++;
      for (const t of types) {
        const c = day[t];
        a.done += c.done;
        a.exp += c.exp;
        a.cells++;
        a.byType[t].done += c.done;
        a.byType[t].exp += c.exp;
        if (c.done === 0) {
          a.notStarted++;
          a.byType[t].notStarted++;
        } else if (c.late) a.late++;
      }
    }
  return a;
}
export const pctOf = (a: { done: number; exp: number }) => (a.exp ? (a.done / a.exp) * 100 : 0);
// Of the checklists that were done at all, the share that came in late.
export const latePct = (a: Agg) => (a.cells - a.notStarted ? (a.late / (a.cells - a.notStarted)) * 100 : 0);

export type DayPoint = { label: string; sub: string; pct: number; notStarted: number };
export function byDay(g: TGrid, outlets: number[], types: CType[] = CTYPES): DayPoint[] {
  return g.days.map((day, k) => {
    let done = 0, exp = 0, notStarted = 0;
    for (const oi of outlets) {
      const x = g.outlets[oi].days[k];
      if (!x) continue;
      for (const t of types) {
        done += x[t].done;
        exp += x[t].exp;
        if (x[t].done === 0) notStarted++;
      }
    }
    return { label: day.label, sub: day.sub, pct: exp ? (done / exp) * 100 : 0, notStarted };
  });
}

export type WeekdayPoint = { label: string; pct: number; notStarted: number };
// Monday first.
export function byWeekday(g: TGrid, outlets: number[], types: CType[] = CTYPES): WeekdayPoint[] {
  const order = [1, 2, 3, 4, 5, 6, 0];
  const t = order.map(() => ({ done: 0, exp: 0, ns: 0 }));
  g.days.forEach((day, k) => {
    const slot = t[order.indexOf(day.dow)];
    for (const oi of outlets) {
      const x = g.outlets[oi].days[k];
      if (!x) continue;
      for (const ty of types) {
        slot.done += x[ty].done;
        slot.exp += x[ty].exp;
        if (x[ty].done === 0) slot.ns++;
      }
    }
  });
  return order.map((dow, i) => ({ label: DOW[dow], pct: t[i].exp ? (t[i].done / t[i].exp) * 100 : 0, notStarted: t[i].ns }));
}

export type TaskMiss = { type: CType; name: string; missed: number; exp: number; rate: number };
// The tasks left undone most often, across the outlets and checklists chosen.
export function taskMisses(g: TGrid, outlets: number[], types: CType[] = CTYPES): TaskMiss[] {
  const out: TaskMiss[] = [];
  for (const t of types) {
    const miss = TASKS[t].map(() => 0);
    let n = 0;
    for (const oi of outlets)
      for (const day of g.outlets[oi].days) {
        if (!day) continue;
        n++;
        miss.forEach((_, i) => {
          if (day[t].missed & (1 << i)) miss[i]++;
        });
      }
    TASKS[t].forEach((k, i) => out.push({ type: t, name: k.name, missed: miss[i], exp: n, rate: n ? (miss[i] / n) * 100 : 0 }));
  }
  return out.sort((a, b) => b.rate - a.rate);
}

// One cell of the day-by-day grid.
export type Heat = { pct: number; done: number; exp: number; notStarted: number; late: number } | null;
export type HeatRow = { key: string; name: string; sub?: string; pct: number; cells: Heat[] };

const heatOf = (list: Cell[]): Heat => {
  if (!list.length) return null;
  let done = 0, exp = 0, notStarted = 0, late = 0;
  for (const c of list) {
    done += c.done;
    exp += c.exp;
    if (c.done === 0) notStarted++;
    else if (c.late) late++;
  }
  return { pct: exp ? (done / exp) * 100 : 0, done, exp, notStarted, late };
};

// A row for each outlet: its day by day compliance for the checklists chosen.
export function heatByOutlet(g: TGrid, outlets: number[], types: CType[]): HeatRow[] {
  return outlets.map((oi) => {
    const cells = g.outlets[oi].days.map((day) => (day ? heatOf(types.map((t) => day[t])) : null));
    const a = aggregate(g, [oi], types);
    return { key: String(oi), name: outletName(oi), sub: outletArea(oi), pct: pctOf(a), cells };
  });
}
// A row for each checklist of one outlet.
export function heatByType(g: TGrid, oi: number, types: CType[]): HeatRow[] {
  return types.map((t) => {
    const cells = g.outlets[oi].days.map((day) => (day ? heatOf([day[t]]) : null));
    return { key: t, name: CTYPE_LABEL[t], pct: pctOf(aggregate(g, [oi], [t])), cells };
  });
}
