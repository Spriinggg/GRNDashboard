"use client";

import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useData } from "@/components/data-provider";
import { DateRangeFilter } from "@/components/date-range-filter";
import { FilterSelect } from "@/components/filter-select";
import { GrnCrossCheck } from "@/components/grn-recon";
import { CheckStatus } from "@/components/item-status";
import { Kpis } from "@/components/kpi-strip";
import { OutletMap } from "@/components/outlet-map";
import { PageHeader } from "@/components/page-header";
import { SortHead, TablePagination } from "@/components/table-parts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { useTableView } from "@/hooks/use-table-view";
import { RM, dKey, fmtD, norm } from "@/lib/calc";
import { dayRows } from "@/lib/checks";
import { NO_SPAN, fromIso, inSpan, isOpen, spanText, type DateSpan } from "@/lib/date-span";
import { outletLocations } from "@/lib/outlet-locations";
import type { MapPin } from "@/lib/outlet-pins";
import { cn } from "@/lib/utils";

const SHOW_LABEL: Record<string, string> = { all: "All days", missing: "Something missing", ok: "Complete" };

export default function Discipline() {
  const { store, grnDocs, setOutlet } = useData();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [show, setShow] = useState("all");
  const [span, setSpan] = useState<DateSpan>(NO_SPAN);
  const [picked, setPicked] = useState("all"); // an outlet name from the map, or "all"

  const rows = useMemo(() => dayRows(store, grnDocs), [store, grnDocs]);
  const pickedKey = picked === "all" ? "" : norm(picked);
  const q = query.trim().toLowerCase();

  // The figures and the map count the outlet and dates chosen, whatever the Checks filter is.
  const scoped = rows.filter((r) => inSpan(r.iso, span) && (!pickedKey || r.ok === pickedKey));
  const filtered = scoped.filter((r) => (show === "all" || (show === "ok" ? r.complete : !r.complete)) && (!q || (r.outlet + " " + fmtD(r.date) + " " + r.date).toLowerCase().includes(q)));
  const missingDays = scoped.filter((r) => !r.complete).length;
  const outletsMissing = new Set(scoped.filter((r) => !r.complete).map((r) => r.ok)).size;

  // The map shows every outlet, so it counts the missing checks of each one for the chosen dates only.
  const pins: MapPin[] = outletLocations.map((l) => {
    const mine = rows.filter((r) => r.ok === norm(l.name) && inSpan(r.iso, span));
    const miss = mine.filter((r) => !r.complete).length;
    const none = rows.every((r) => r.ok !== norm(l.name));
    const words = none ? "no data yet" : `${miss} of ${mine.length} days with a missing check`;
    return { name: l.name, lat: l.lat, lng: l.lng, region: l.region, value: String(miss), hot: miss > 0, empty: none, title: `${l.name}: ${words}`, tip: `${l.name} · ${words}` };
  });

  const view = useTableView(filtered, {
    resetKey: `${show}|${q}|${span.from}|${span.to}|${picked}`,
    sorts: { outlet: (r) => r.outlet, date: (r) => dKey(r.date), count: (r) => Number(r.counted), grn: (r) => Number(r.grn), ded: (r) => Number(r.ded), variance: (r) => r.total },
  });

  const dates = rows.map((r) => r.iso).filter(Boolean).sort();
  const min = dates.length ? fromIso(dates[0]) : new Date(2026, 0, 1);
  const max = dates.length ? fromIso(dates[dates.length - 1]) : new Date(2026, 11, 31);
  const narrowed = show !== "all" || !isOpen(span) || picked !== "all" || q !== "";
  const clearAll = () => {
    setShow("all");
    setSpan(NO_SPAN);
    setPicked("all");
    setQuery("");
  };
  const toggleShow = (v: string) => setShow((s) => (s === v ? "all" : v));
  const nOutlets = new Set(rows.map((r) => r.ok)).size;

  return (
    <>
      <PageHeader title="Count & GRN" subtitle={`Do the outlets count daily and record goods received? · ${rows.length} outlet-days loaded`} />

      <section aria-label="Summary" className="flex flex-col gap-2">
        <div className="grid gap-4 md:grid-cols-12">
          <div className="flex md:col-span-5">
            <Kpis
              vertical
              label="Counting and receiving"
              kpis={[
                { key: "missing", label: "days with a missing check", count: missingDays, note: "A day where the stock count, the GRN or the POS deductions are missing.", tone: "warning", on: show === "missing", onPick: () => toggleShow("missing") },
                { key: "ok", label: "complete days", count: scoped.length - missingDays, note: "Stock counted, GRN posted and POS deductions present.", on: show === "ok", onPick: () => toggleShow("ok") },
                { key: "outlets", label: `of ${nOutlets || 0} outlets with a gap`, count: outletsMissing, note: "Outlets that have at least one day with a missing check in these dates." },
              ]}
            />
          </div>
          <div className="flex md:col-span-7">
            <OutletMap
              pins={pins}
              selected={picked === "all" ? "" : picked}
              onSelect={(name) => setPicked((p) => (p === name ? "all" : name))}
              legend={[
                { label: "Number: days with a missing check", swatch: "figure" },
                { label: "Has a missing check", swatch: "hot" },
                { label: "No data yet", swatch: "empty" },
                { label: "Selected outlet", swatch: "selected" },
              ]}
              help="Click an outlet to filter the days, click it again to show all."
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Click a figure or an outlet to filter the days. Figures follow the outlet and the dates chosen below.</p>
      </section>

      <Card className="gap-0 p-0 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Search outlet or day" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search outlet or day" className="h-9 w-full pl-8 md:w-64" />
          </div>
          <FilterSelect
            boxed
            label="Checks"
            value={show}
            onChange={setShow}
            options={[
              { value: "all", label: "All days", meta: String(scoped.length) },
              { value: "missing", label: "Something missing", meta: String(missingDays) },
              { value: "ok", label: "Complete", meta: String(scoped.length - missingDays) },
            ]}
          />
          <DateRangeFilter label="Days" value={span} onChange={setSpan} min={min} max={max} />
        </div>
        {show !== "all" || !isOpen(span) || picked !== "all" ? (
          <div className="flex flex-wrap items-center gap-2 border-t px-4 py-3">
            {show !== "all" ? <Chip label={`Checks: ${SHOW_LABEL[show]}`} onClear={() => setShow("all")} /> : null}
            {!isOpen(span) ? <Chip label={`Days: ${spanText(span)}`} onClear={() => setSpan(NO_SPAN)} /> : null}
            {picked !== "all" ? <Chip label={`Outlet: ${picked}`} onClear={() => setPicked("all")} /> : null}
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={clearAll}>
              Clear all
            </Button>
          </div>
        ) : null}
      </Card>

      <Card className="gap-0 p-0 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3">
          <p aria-live="polite" className="text-sm">
            <span key={`${filtered.length}-${show}-${picked}`} className="animate-in fade-in duration-300">
              <b className="text-base font-semibold tabular-nums">
                {filtered.length} {filtered.length === 1 ? "day" : "days"}
              </b>
            </span>
            {show !== "all" ? <span className="text-muted-foreground"> · {SHOW_LABEL[show]}</span> : null}
            {picked !== "all" ? <span className="text-muted-foreground"> · {picked}</span> : null}
            {!isOpen(span) ? <span className="text-muted-foreground"> · {spanText(span)}</span> : null}
            {q ? <span className="text-muted-foreground"> · matching “{query.trim()}”</span> : null}
          </p>
          {narrowed ? (
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={clearAll}>
              Clear filters
            </Button>
          ) : null}
        </div>
        <div className="overflow-x-auto px-2 pb-2">
          <Table className="min-w-[860px]">
            <TableHeader>
              <TableRow>
                <SortHead label="Outlet" sortKey="outlet" sort={view.sort} onSort={view.toggleSort} className="text-left" />
                <SortHead label="Day" sortKey="date" sort={view.sort} onSort={view.toggleSort} className="text-center" />
                <SortHead label="Stock count" sortKey="count" sort={view.sort} onSort={view.toggleSort} className="text-center" />
                <SortHead label="GRN" sortKey="grn" sort={view.sort} onSort={view.toggleSort} className="text-center" />
                <SortHead label="POS deductions" sortKey="ded" sort={view.sort} onSort={view.toggleSort} className="text-center" />
                <SortHead label="Variance" sortKey="variance" sort={view.sort} onSort={view.toggleSort} className="text-center" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {view.rows.map((r) => (
                <TableRow
                  key={r.key}
                  className={cn(r.counted && "cursor-pointer")}
                  onClick={() => {
                    if (!r.counted) return;
                    setOutlet(r.ok);
                    router.push("/");
                  }}
                >
                  <TableCell className="pl-3">
                    <span className="font-bold">{r.outlet}</span>
                    {r.sample ? <span className="block text-xs text-muted-foreground">Sample data</span> : <span className="block text-xs text-muted-foreground">{r.missing ? `${r.missing} of 3 checks missing` : "All 3 checks done"}</span>}
                  </TableCell>
                  <TableCell className="text-center tabular-nums">{fmtD(r.date)}</TableCell>
                  <TableCell className="text-center">
                    <CheckStatus ok={r.counted} yes={`${r.nCounts} count${r.nCounts > 1 ? "s" : ""}`} no="Missing" tip={r.counted ? "Opening and closing stock counts were posted for this day." : "No stock count file for this day, so the variance cannot be worked out."} />
                  </TableCell>
                  <TableCell className="text-center">
                    <CheckStatus ok={r.grn} yes="Posted" no="Missing" tip={r.grn ? "Goods received were recorded in the stock movement." : "No goods received note found. Deliveries may not have been booked in."} />
                  </TableCell>
                  <TableCell className="text-center">
                    <CheckStatus ok={r.ded} yes="Present" no="Missing" tip={r.ded ? "Sales deducted stock through the POS." : "No POS deductions found. Upload the sales or movement file."} />
                  </TableCell>
                  <TableCell className={cn("text-right font-bold tabular-nums", r.counted && r.total <= -10 && "text-danger")}>{r.counted ? RM(r.total) : "None"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filtered.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="font-semibold">{rows.length ? "No days match these filters" : "No data loaded"}</p>
              {rows.length ? (
                <Button variant="outline" className="mt-4" onClick={clearAll}>
                  Clear filters
                </Button>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">Upload the daily files on the Upload page to check counting and GRN.</p>
              )}
            </div>
          ) : null}
        </div>
        <TablePagination view={view} noun="days" note="A missing count or GRN is where variance starts. Select a day with a count to open that outlet." />
      </Card>
      <GrnCrossCheck />
    </>
  );
}

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button
      type="button"
      onClick={onClear}
      aria-label={`Remove filter: ${label}`}
      className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs font-medium outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
    >
      {label}
      <X aria-hidden className="size-3" />
    </button>
  );
}
