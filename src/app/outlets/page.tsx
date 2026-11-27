"use client";

import { AlertTriangle, CircleAlert, CircleCheck, CircleSlash, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useData } from "@/components/data-provider";
import { FilterSelect } from "@/components/filter-select";
import { Kpis } from "@/components/kpi-strip";
import { OutletMap } from "@/components/outlet-map";
import type { MapPin } from "@/lib/outlet-pins";
import { PageHeader } from "@/components/page-header";
import { StatusIndicator } from "@/components/status-indicator";
import { SortHead, TablePagination } from "@/components/table-parts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { useTableView } from "@/hooks/use-table-view";
import { RM, fmtD } from "@/lib/calc";
import { REGION_LABEL } from "@/lib/outlet-locations";
import { outletRows, type OutletRow, type OutletStatus } from "@/lib/outlets";
import { cn } from "@/lib/utils";

const ST_LABEL: Record<string, string> = { all: "All", crit: "Critical", warn: "Short", good: "On target", none: "No data yet" };
const ST_RANK: Record<OutletStatus, number> = { crit: 0, warn: 1, good: 2, none: 3 };

function OutletState({ s }: { s: OutletStatus }) {
  if (s === "crit")
    return (
      <StatusIndicator icon={AlertTriangle} tone="danger">
        Critical
      </StatusIndicator>
    );
  if (s === "warn")
    return (
      <StatusIndicator icon={CircleAlert} tone="warning">
        Short
      </StatusIndicator>
    );
  if (s === "good")
    return (
      <StatusIndicator icon={CircleCheck} tone="success">
        On target
      </StatusIndicator>
    );
  return (
    <StatusIndicator icon={CircleSlash} tone="muted">
      No data yet
    </StatusIndicator>
  );
}

export default function Outlets() {
  const { store, setOutlet } = useData();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [st, setSt] = useState("all");
  const [region, setRegion] = useState("all");
  const [picked, setPicked] = useState("all");

  const all = useMemo(() => outletRows(store), [store]);
  const pins: MapPin[] = all.map((r) => ({
    name: r.name,
    lat: r.lat,
    lng: r.lng,
    region: r.region,
    value: r.on ? RM(r.total) : "",
    hot: r.on && r.crit > 0,
    empty: !r.on,
    title: r.on ? `${r.name}: food variance ${RM(r.total)}, ${r.flagged} items flagged` : `${r.name}: no data yet`,
    tip: r.on ? `${r.name} · ${RM(r.total)} · ${r.flagged} flagged` : `${r.name} · no data yet`,
  }));
  const withData = all.filter((r) => r.on);
  const critN = withData.filter((r) => r.status === "crit").length;

  const q = query.trim().toLowerCase();
  const filtered = all.filter(
    (r) =>
      (st === "all" || r.status === st) &&
      (region === "all" || r.region === region) &&
      (picked === "all" || r.name === picked) &&
      (!q || (r.name + " " + r.area).toLowerCase().includes(q)),
  );
  // The original order is A to Z.
  const ordered = useMemo(() => filtered.slice().sort((a, b) => a.name.localeCompare(b.name)), [filtered]);
  const view = useTableView(ordered, {
    resetKey: `${st}|${region}|${picked}|${q}`,
    sorts: { name: (r) => r.name, region: (r) => r.region, days: (r) => r.days, last: (r) => (r.last ? r.last.split("/").reverse().join("") : ""), flagged: (r) => r.flagged, variance: (r) => (r.on ? r.total : 1e9), status: (r) => ST_RANK[r.status] },
  });
  const narrowed = st !== "all" || region !== "all" || picked !== "all" || q !== "";
  const clearAll = () => {
    setSt("all");
    setRegion("all");
    setPicked("all");
    setQuery("");
  };
  const open = (r: OutletRow) => {
    if (!r.on) return;
    setOutlet(r.ok);
    router.push("/");
  };
  const showView = (s: string) => {
    setSt((cur) => (cur === s ? "all" : s));
    setPicked("all");
  };

  return (
    <>
      <PageHeader title="Outlets" subtitle={`44 HQ outlets · ${withData.length} with data`} />

      <section aria-label="Summary" className="flex flex-col gap-2">
        <div className="grid gap-4 md:grid-cols-12">
          <div className="flex md:col-span-5">
            <Kpis
              vertical
              label="Outlets that need attention"
              kpis={[
                { key: "crit", label: "outlets with a critical item", count: critN, note: "Latest loaded day has an item short by RM 50 or more.", tone: "danger", on: st === "crit", onPick: () => showView("crit") },
                { key: "data", label: "outlets with data", count: withData.length, note: "At least one day loaded.", on: st === "good", onPick: () => showView("good") },
                { key: "none", label: "outlets with no data yet", count: all.length - withData.length, note: "Nothing uploaded for these outlets.", on: st === "none", onPick: () => showView("none") },
              ]}
            />
          </div>
          <div className="flex md:col-span-7">
            <OutletMap
              pins={pins}
              selected={picked === "all" ? "" : picked}
              onSelect={(name) => setPicked((p) => (p === name ? "all" : name))}
              legend={[
                { label: "Figure: food variance of the latest day", swatch: "figure" },
                { label: "Has a critical item", swatch: "hot" },
                { label: "No data yet", swatch: "empty" },
                { label: "Selected outlet", swatch: "selected" },
              ]}
              help="Click an outlet to filter the list, click it again to show all."
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Click a figure or an outlet on the map to filter the list. Figures use the latest loaded day of each outlet.</p>
      </section>

      <Card className="gap-0 p-0 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Search outlets" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search outlets" className="h-9 w-full pl-8 md:w-64" />
          </div>
          <FilterSelect
            boxed
            label="Status"
            value={st}
            onChange={setSt}
            options={(["all", "crit", "warn", "good", "none"] as const).map((k) => ({ value: k, label: ST_LABEL[k], meta: String(k === "all" ? all.length : all.filter((r) => r.status === k).length) }))}
          />
          <FilterSelect boxed label="Area" value={region} onChange={setRegion} options={[{ value: "all", label: "All areas" }, ...(Object.keys(REGION_LABEL) as (keyof typeof REGION_LABEL)[]).map((k) => ({ value: k as string, label: REGION_LABEL[k] }))]} />
        </div>
        {narrowed && (st !== "all" || region !== "all" || picked !== "all") ? (
          <div className="flex flex-wrap items-center gap-2 border-t px-4 py-3">
            {st !== "all" ? <Chip label={`Status: ${ST_LABEL[st]}`} onClear={() => setSt("all")} /> : null}
            {region !== "all" ? <Chip label={`Area: ${REGION_LABEL[region as keyof typeof REGION_LABEL]}`} onClear={() => setRegion("all")} /> : null}
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
            <b className="text-base font-semibold tabular-nums">
              {filtered.length} {filtered.length === 1 ? "outlet" : "outlets"}
            </b>
            {st !== "all" ? <span className="text-muted-foreground"> · {ST_LABEL[st]}</span> : null}
            {q ? <span className="text-muted-foreground"> · matching “{query.trim()}”</span> : null}
          </p>
          {narrowed ? (
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={clearAll}>
              Clear filters
            </Button>
          ) : null}
        </div>
        <div className="overflow-x-auto px-2 pb-2">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <SortHead label="Outlet" sortKey="name" sort={view.sort} onSort={view.toggleSort} className="text-left" />
                <SortHead label="Area" sortKey="region" sort={view.sort} onSort={view.toggleSort} className="text-center" />
                <SortHead label="Days loaded" sortKey="days" sort={view.sort} onSort={view.toggleSort} className="text-center" />
                <SortHead label="Latest day" sortKey="last" sort={view.sort} onSort={view.toggleSort} className="text-center" />
                <SortHead label="Items flagged" sortKey="flagged" sort={view.sort} onSort={view.toggleSort} className="text-center" />
                <SortHead label="Variance" sortKey="variance" sort={view.sort} onSort={view.toggleSort} className="text-center" />
                <SortHead label="Status" sortKey="status" sort={view.sort} onSort={view.toggleSort} className="text-center" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {view.rows.map((r) => (
                <TableRow key={r.name} className={cn(r.on && "cursor-pointer")} onClick={() => open(r)}>
                  <TableCell className="pl-3">
                    {r.on ? (
                      <button
                        type="button"
                        aria-label={`Open ${r.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          open(r);
                        }}
                        className="rounded font-bold outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {r.name}
                      </button>
                    ) : (
                      <span className="font-bold text-muted-foreground">{r.name}</span>
                    )}
                    <span className="block text-xs text-muted-foreground">{r.area}</span>
                  </TableCell>
                  <TableCell className="text-center">{REGION_LABEL[r.region]}</TableCell>
                  <TableCell className="text-center tabular-nums">{r.on ? r.days : "None"}</TableCell>
                  <TableCell className="text-center tabular-nums">{r.last ? fmtD(r.last) : "None"}</TableCell>
                  <TableCell className="text-center tabular-nums">{r.on ? r.flagged : "None"}</TableCell>
                  <TableCell className={cn("text-right font-bold tabular-nums", r.on && r.total <= -10 && "text-danger")}>{r.on ? RM(r.total) : "None"}</TableCell>
                  <TableCell className="text-center">
                    <OutletState s={r.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filtered.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="font-semibold">No outlets match these filters</p>
              <Button variant="outline" className="mt-4" onClick={clearAll}>
                Clear filters
              </Button>
            </div>
          ) : null}
        </div>
        <TablePagination view={view} noun="outlets" note="Select an outlet with data to open its dashboard." />
      </Card>
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
