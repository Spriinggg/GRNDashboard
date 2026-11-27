import type { Store } from "@/lib/types";
import { datesFor, norm, outletsOf, statusOf, totVar } from "@/lib/calc";
import { outletLocations, type Region } from "@/lib/outlet-locations";

export type OutletStatus = "crit" | "warn" | "good" | "none";
export type OutletRow = {
  name: string;
  area: string;
  region: Region;
  lat: number;
  lng: number;
  ok: string;
  on: boolean;
  days: number;
  last: string | null;
  total: number; // food variance of the latest loaded day
  flagged: number; // items outside +/- RM 10 on that day
  crit: number;
  status: OutletStatus;
};

// One row for each of the 44 HQ outlets, with the figures of its latest loaded day.
export function outletRows(store: Store): OutletRow[] {
  const os = outletsOf(store);
  const keys = Object.keys(os);
  return outletLocations.map((l) => {
    const k = keys.find((x) => os[x].name.toLowerCase() === l.name.toLowerCase());
    const base = { ...l, ok: k || norm(l.name) };
    if (!k) return { ...base, on: false, days: 0, last: null, total: 0, flagged: 0, crit: 0, status: "none" as const };
    const last = datesFor(store, k).slice(-1)[0];
    const d = store[k + "|" + last];
    const items = d.items ?? [];
    const crit = items.filter((i) => statusOf(i)[0] === "crit").length;
    const warn = items.filter((i) => statusOf(i)[0] === "warn").length;
    return {
      ...base,
      on: true,
      days: os[k].dates.length,
      last,
      total: totVar(d),
      flagged: items.filter((i) => statusOf(i)[0] !== "good").length,
      crit,
      status: crit ? "crit" : warn ? "warn" : "good",
    };
  });
}
