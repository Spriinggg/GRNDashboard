"use client";

import { useEffect, useMemo, useState } from "react";
import { useData } from "@/components/data-provider";
import { dayRows } from "@/lib/checks";
import { MTD_SPAN, buildOverview } from "@/lib/dashboard-data";
import { TARGET as LABOUR_TARGET } from "@/lib/labour-mock";
import { OUTLETS } from "@/lib/overview-mock";
import { outletRows } from "@/lib/outlets";
import { TARGET as TREAMS_TARGET } from "@/lib/treeams-mock";

export type Alert = { key: string; tone: "danger" | "warning" | "info"; title: string; detail: string; href: string };

const pts = (v: number) => `${Math.abs(v).toFixed(1)} points`;

// The things to look at first, most serious first, for all outlets and the month to date. They open the page where each can be
// dealt with. The top bar shows them in the bell, so they are the same on every page. The sample-data ones (shortages, margin,
// labour, checklists) become real when those reports are loaded. Worked out a moment after the page is shown, so it never
// holds up the first paint.
export function useAlerts(): { alerts: Alert[]; scope: string; ready: boolean } {
  const { store, grnDocs, daysByOutlet, ensureRange } = useData();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 80);
    return () => clearTimeout(t);
  }, []);

  // The alerts look at the month to date, so make sure those days are loaded.
  useEffect(() => {
    void ensureRange(MTD_SPAN);
  }, [ensureRange]);

  const alerts = useMemo<Alert[]>(() => {
    if (!ready) return [];
    const ov = buildOverview(MTD_SPAN, OUTLETS.map((_, o) => o));
    const outlets = outletRows(store, daysByOutlet);
    const withData = outlets.filter((r) => r.on);
    const crit = withData.filter((r) => r.status === "crit").length;
    const okSet = new Set(withData.map((r) => r.ok));
    const days = dayRows(store, grnDocs).filter((r) => okSet.has(r.ok) && r.iso >= MTD_SPAN.from && r.iso <= MTD_SPAN.to);
    const missing = days.filter((r) => !r.complete).length;
    const out: Alert[] = [];
    if (crit) out.push({ key: "crit", tone: "danger", title: `${crit} ${crit === 1 ? "outlet has" : "outlets have"} a critical item`, detail: "An item is short by RM 50 or more on the latest loaded day.", href: "/outlets" });
    if (ov.food.repeated) out.push({ key: "repeat", tone: "danger", title: `${ov.food.repeated} ${ov.food.repeated === 1 ? "pair is" : "pairs are"} repeatedly short`, detail: `Outlet and item pairs short on at least 3 days, in ${ov.food.outletsWithRepeat} ${ov.food.outletsWithRepeat === 1 ? "outlet" : "outlets"}. Likely a real loss.`, href: "/variance" });
    if (ov.pnl.marginPts !== null && ov.pnl.marginPts <= -1) out.push({ key: "margin", tone: "warning", title: `Gross margin is down ${pts(ov.pnl.marginPts)}`, detail: `${ov.pnl.margin.toFixed(1)}% now. Fees are ${ov.pnl.feesPct.toFixed(1)}% and the cost of food ${ov.pnl.foodPct.toFixed(1)}% of sales.`, href: "/pnl" });
    if (ov.labour.over) out.push({ key: "labour", tone: "warning", title: `${ov.labour.over} of ${ov.labour.of} outlets are over the ${LABOUR_TARGET}% labour target`, detail: `Labour is ${ov.labour.pct.toFixed(1)}% of net sales.`, href: "/labor" });
    if (ov.treeams.under) out.push({ key: "treeams", tone: "warning", title: `${ov.treeams.under} of ${ov.treeams.of} outlets are under ${TREAMS_TARGET}% of checklist tasks done`, detail: `${ov.treeams.notStarted} checklists were not started at all.`, href: "/treeams" });
    if (missing) out.push({ key: "days", tone: "warning", title: `${missing} of ${days.length} loaded ${days.length === 1 ? "day has" : "days have"} a missing check`, detail: "Stock count, GRN or POS deductions not found.", href: "/discipline" });
    if (withData.length < outlets.length) out.push({ key: "nodata", tone: "info", title: `${outlets.length - withData.length} of ${outlets.length} outlets have no data yet`, detail: "Upload their files to include them.", href: "/upload" });
    return out;
  }, [ready, store, grnDocs, daysByOutlet]);

  return { alerts, scope: "All outlets, month to date", ready };
}
