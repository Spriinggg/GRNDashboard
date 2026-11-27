import type { Store } from "@/lib/types";
import { dKey, dayChecks, toIsoDate, totVar } from "@/lib/calc";

export type DayRow = {
  key: string;
  ok: string; // outlet key
  outlet: string;
  date: string; // dd/mm/yyyy
  iso: string; // yyyy-mm-dd
  counted: boolean;
  nCounts: number;
  grn: boolean;
  ded: boolean;
  complete: boolean;
  missing: number; // how many of the three checks are missing
  total: number; // food variance of the day, 0 when there was no count
  sample: boolean;
};

// One row for every outlet and day that has any file loaded, with the three checks the page is about:
// was stock counted, was a GRN posted, and do the POS deductions show in the stock movement.
export function dayRows(store: Store, grnDocs: string[]): DayRow[] {
  return Object.keys(store)
    .map((key) => {
      const x = store[key];
      const c = dayChecks(x);
      const counted = !!x.nCounts;
      const grn = c.hasGrn || (x.sample && grnDocs.length > 0);
      const ded = c.hasDed || !!x.sales;
      const missing = [counted, grn, ded].filter((v) => !v).length;
      return { key, ok: x.ok, outlet: x.outlet, date: x.date, iso: toIsoDate(x.date), counted, nCounts: x.nCounts ?? 0, grn, ded, complete: missing === 0, missing, total: totVar(x), sample: x.sample };
    })
    .sort((a, b) => dKey(b.date) - dKey(a.date) || a.outlet.localeCompare(b.outlet));
}
