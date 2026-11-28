"use client";

import { ArrowLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { FilterSelect } from "@/components/filter-select";
import { Kpis } from "@/components/kpi-strip";
import { PageHeader } from "@/components/page-header";
import { Chip, FilterBar, FilterSearch } from "@/components/sales-ui";
import { SortHead, TablePagination } from "@/components/table-parts";
import { ComplianceBars, ComplianceTrend, HeatGrid, WeekdayBars } from "@/components/treeams-charts";
import type { BarRow } from "@/components/treeams-charts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { useTableView } from "@/hooks/use-table-view";
import { OUTLETS, REGION_LABEL } from "@/lib/overview-mock";
import type { Region } from "@/lib/outlet-locations";
import { CTYPES, CTYPE_LABEL, TARGET, TPERIODS, aggregate, byDay, byWeekday, heatByOutlet, heatByType, latePct, outletArea, outletName, pctOf, regionOf, taskMisses, tPeriodOf, treamsGrid } from "@/lib/treeams-mock";
import type { CType } from "@/lib/treeams-mock";
import { cn } from "@/lib/utils";

type TState = "all" | "under" | "on";
type TStart = "all" | "some";
const T_STATE: { value: TState; label: string }[] = [
  { value: "all", label: "Any" },
  { value: "under", label: `Under ${TARGET}%` },
  { value: "on", label: `${TARGET}% or more` },
];
const T_START: { value: TStart; label: string }[] = [
  { value: "all", label: "Any" },
  { value: "some", label: "One or more" },
];
const TYPE_OPTIONS: { value: "all" | CType; label: string }[] = [{ value: "all", label: "All checklists" }, ...CTYPES.map((t) => ({ value: t, label: CTYPE_LABEL[t] }))];

export default function Treeams() {
  const [period, setPeriod] = useState("mtd");
  const [region, setRegion] = useState<"all" | Region>("all");
  const [ctype, setCtype] = useState<"all" | CType>("all");
  const [q, setQ] = useState("");
  // Selecting an outlet makes the whole page about it.
  const [selO, setSelO] = useState<number | null>(null);
  const [tq, setTq] = useState("");
  const [tstate, setTstate] = useState<TState>("all");
  const [tstart, setTstart] = useState<TStart>("all");

  const pd = tPeriodOf(period);
  const g = useMemo(() => treamsGrid(pd.ranges), [pd]);
  const types = useMemo<CType[]>(() => (ctype === "all" ? CTYPES : [ctype]), [ctype]);
  const needle = q.trim().toLowerCase();

  // Every outlet the filters let through, with its own totals for the checklists chosen and for all of them.
  const rows = useMemo(
    () =>
      OUTLETS.map((_, o) => o)
        .filter((o) => (region === "all" || regionOf(o) === region) && (!needle || (outletName(o) + " " + outletArea(o)).toLowerCase().includes(needle)))
        .map((o) => ({ o, a: aggregate(g, [o], types), all: aggregate(g, [o], CTYPES) }))
        .filter((r) => r.a.days > 0),
    [g, types, region, needle],
  );
  const pool = useMemo(() => rows.map((r) => r.o), [rows]);
  const focus = useMemo(() => (selO !== null ? [selO] : pool), [selO, pool]);
  const a = useMemo(() => aggregate(g, focus, types), [g, focus, types]);
  const net = useMemo(() => aggregate(g, pool, types), [g, pool, types]);
  const scope = selO !== null ? outletName(selO) : region === "all" ? "all outlets" : REGION_LABEL[region];

  const pct = pctOf(a);
  const under = rows.filter((r) => pctOf(r.a) < TARGET).length;
  const worst = useMemo(() => [...rows].sort((x, y) => pctOf(x.a) - pctOf(y.a)), [rows]);

  // Bars: the ten outlets furthest under the target, and the one chosen if it is not among them.
  const outletBars: BarRow[] = useMemo(() => {
    const top = worst.slice(0, 10);
    if (selO !== null && !top.some((r) => r.o === selO)) {
      const r = worst.find((x) => x.o === selO);
      if (r) top.push(r);
    }
    return top.map((r) => ({
      key: String(r.o),
      name: outletName(r.o),
      sub: outletArea(r.o),
      pct: pctOf(r.a),
      selected: selO === r.o,
      tip: [["Tasks done", `${r.a.done} of ${r.a.exp}`], ["Checklists not started", String(r.a.notStarted)], ["Done late", String(r.a.late)]],
    }));
  }, [worst, selO]);

  // The checklist bars are not narrowed by the checklist chosen, so the one you picked stays in view.
  const typeAgg = useMemo(() => aggregate(g, focus, CTYPES), [g, focus]);
  const typeBars: BarRow[] = CTYPES.map((t) => ({
    key: t,
    name: CTYPE_LABEL[t],
    pct: pctOf(typeAgg.byType[t]),
    selected: ctype === t,
    tip: [["Tasks done", `${typeAgg.byType[t].done} of ${typeAgg.byType[t].exp}`], ["Checklists not started", String(typeAgg.byType[t].notStarted)]],
  }));
  const worstType = [...typeBars].sort((x, y) => x.pct - y.pct)[0];

  const trend = useMemo(() => byDay(g, focus, types), [g, focus, types]);
  const weekday = useMemo(() => byWeekday(g, focus, types), [g, focus, types]);
  const lowDay = [...weekday].sort((x, y) => x.pct - y.pct)[0];
  const misses = useMemo(() => taskMisses(g, focus, types), [g, focus, types]);
  const topMiss = misses.slice(0, 8);
  const maxRate = Math.max(1, ...topMiss.map((m) => m.rate));
  const skippers = useMemo(() => [...rows].sort((x, y) => y.a.notStarted - x.a.notStarted).filter((r) => r.a.notStarted > 0).slice(0, 6), [rows]);

  // The grid: the twelve outlets furthest under the target, or the checklists of the outlet chosen.
  const heat = useMemo(() => {
    if (selO !== null) return heatByType(g, selO, types);
    return heatByOutlet(g, worst.slice(0, 12).map((r) => r.o), types);
  }, [g, selO, worst, types]);

  // The table narrows its own rows, on top of the filters at the head of the page.
  const tNarrowed = !!tq || tstate !== "all" || tstart !== "all";
  const clearTable = () => {
    setTq("");
    setTstate("all");
    setTstart("all");
  };
  const tableRows = useMemo(() => {
    const t = tq.trim().toLowerCase();
    return rows
      .filter((r) => (!t || (outletName(r.o) + " " + outletArea(r.o)).toLowerCase().includes(t)) && (tstate === "all" || (tstate === "under" ? pctOf(r.a) < TARGET : pctOf(r.a) >= TARGET)) && (tstart === "all" || r.a.notStarted > 0))
      .sort((x, y) => pctOf(x.a) - pctOf(y.a));
  }, [rows, tq, tstate, tstart]);
  const tv = useTableView(tableRows, {
    pageSize: 10,
    resetKey: `${period}|${region}|${ctype}|${q}|${tq}|${tstate}|${tstart}`,
    sorts: {
      name: (r) => outletName(r.o),
      pct: (r) => pctOf(r.a),
      opening: (r) => pctOf(r.all.byType.opening),
      closing: (r) => pctOf(r.all.byType.closing),
      manager: (r) => pctOf(r.all.byType.manager),
      cash: (r) => pctOf(r.all.byType.cash),
      ns: (r) => r.a.notStarted,
      late: (r) => r.a.late,
    },
  });

  const reset = () => {
    setPeriod("mtd");
    setRegion("all");
    setCtype("all");
    setQ("");
    setSelO(null);
  };
  const rank = selO !== null ? worst.findIndex((r) => r.o === selO) + 1 : 0;
  const pickOutlet = (k: string) => setSelO((s) => (s === +k ? null : +k));
  const pickType = (k: string) => setCtype((c) => (c === k ? "all" : (k as CType)));
  const days = g.days.map((d) => ({ label: d.label, sub: d.sub }));
  const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

  return (
    <>
      <PageHeader
        title="Treeams checklists"
        subtitle={
          <>
            Did each outlet finish its daily checklists, and which tasks get skipped.{" "}
            <span className="ml-1 rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-foreground">Sample data</span>
          </>
        }
      />

      {selO !== null ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <nav aria-label="Path" className="flex flex-wrap items-center gap-1.5 text-sm">
            <Button variant="outline" size="sm" onClick={() => setSelO(null)} aria-label="Back to all outlets">
              <ArrowLeft aria-hidden /> Back
            </Button>
            <ol className="flex flex-wrap items-center gap-1.5">
              <li>
                <button type="button" onClick={() => setSelO(null)} className="rounded text-muted-foreground outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                  All outlets
                </button>
              </li>
              <li aria-hidden className="text-muted-foreground"><ChevronRight className="size-3.5" /></li>
              <li aria-current="page" className="font-semibold">{outletName(selO)}</li>
            </ol>
          </nav>
          <p className="text-sm text-muted-foreground">Number {rank} of {rows.length} outlets, lowest first. {pct.toFixed(1)}%, all outlets {pctOf(net).toFixed(1)}%.</p>
        </div>
      ) : null}

      <FilterBar
        active={[
          ...(period !== "mtd" ? [{ key: "period", label: `Period: ${pd.label}`, onClear: () => setPeriod("mtd") }] : []),
          ...(region !== "all" ? [{ key: "region", label: `Region: ${REGION_LABEL[region]}`, onClear: () => setRegion("all") }] : []),
          ...(ctype !== "all" ? [{ key: "type", label: `Checklist: ${CTYPE_LABEL[ctype]}`, onClear: () => setCtype("all") }] : []),
          ...(q ? [{ key: "q", label: `Outlet: “${q}”`, onClear: () => setQ("") }] : []),
        ]}
        onClearAll={reset}
        summary={`${selO !== null ? outletName(selO) : `${rows.length} outlets`} · ${pd.label} · ${ctype === "all" ? "all checklists" : CTYPE_LABEL[ctype].toLowerCase()}`}
      >
        <FilterSearch value={q} onChange={setQ} placeholder="Search outlets" />
        <FilterSelect boxed label="Period" value={period} onChange={setPeriod} options={TPERIODS.map((p) => ({ value: p.key, label: p.label }))} />
        <FilterSelect boxed label="Region" value={region} onChange={(v) => setRegion(v as "all" | Region)} options={[{ value: "all", label: "All regions" }, ...(Object.keys(REGION_LABEL) as Region[]).map((r) => ({ value: r, label: REGION_LABEL[r] }))]} />
        <FilterSelect boxed label="Checklist" value={ctype} onChange={(v) => setCtype(v as "all" | CType)} options={TYPE_OPTIONS} />
      </FilterBar>

      <section aria-label="Summary">
        <Kpis
          label="Checklist summary"
          columns={4}
          stacked
          kpis={[
            { key: "pct", count: `${pct.toFixed(1)}%`, label: `of tasks done · target ${TARGET}%`, note: `Tasks ticked as done out of the tasks expected, ${pd.label}, ${scope}. ${a.done.toLocaleString("en")} of ${a.exp.toLocaleString("en")}.`, tone: pct < TARGET - 5 ? "danger" : pct < TARGET ? "warning" : undefined },
            { key: "under", count: `${under} of ${rows.length}`, label: `outlets under ${TARGET}%`, note: `Outlets whose tasks done is under the ${TARGET}% target for the checklists chosen.`, tone: under ? "warning" : undefined },
            { key: "ns", count: a.notStarted, label: "checklists not started at all", note: "A checklist with no task ticked for the day. That is a whole routine skipped, not a few missed tasks.", tone: a.notStarted ? "warning" : undefined },
            { key: "late", count: `${latePct(a).toFixed(1)}%`, label: "of checklists done late", note: "Checklists that were done after their time window, out of those done at all. The time of each tick is Planned in the real report." },
          ]}
        />
      </section>

      <Card className="gap-0 p-0 shadow-sm">
        <section aria-label="Outlets and checklists" className="grid lg:grid-cols-12">
          <div className="flex min-w-0 flex-col gap-3 border-b p-6 lg:col-span-7 lg:border-r lg:border-b-0">
            <div>
              <h2 className="text-base font-semibold">Tasks done, by outlet</h2>
              <p className="text-xs text-muted-foreground">The ten outlets furthest under the {TARGET}% target. {under} of {rows.length} are under it. Click one to look at it.</p>
            </div>
            <ComplianceBars rows={outletBars} hasSelection={selO !== null} onPick={pickOutlet} hint="Click to look at this outlet" label={`Tasks done for the ten lowest outlets against the ${TARGET} percent target. ${under} of ${rows.length} outlets are under it.`} />
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><i aria-hidden className="inline-block size-2.5 rounded-[3px] bg-primary/90" /> Under the target</span>
              <span className="flex items-center gap-1.5"><i aria-hidden className="inline-block size-2.5 rounded-[3px] bg-muted-foreground/60" /> On target</span>
              <span className="flex items-center gap-1.5"><i aria-hidden className="inline-block h-0 w-4 border-t-2 border-dashed border-muted-foreground" /> Target</span>
            </p>
          </div>
          <div className="flex min-w-0 flex-col gap-3 p-6 lg:col-span-5">
            <div>
              <h2 className="text-base font-semibold">Tasks done, by checklist</h2>
              <p className="text-xs text-muted-foreground">{cap(scope)}. {worstType ? `${worstType.name} is the weakest at ${Math.round(worstType.pct)}%.` : ""} Click one to show only that checklist.</p>
            </div>
            <ComplianceBars rows={typeBars} hasSelection={ctype !== "all"} onPick={pickType} hint="Click to show only this checklist" label={`Tasks done for each checklist against the ${TARGET} percent target. ${worstType ? `${worstType.name} is the weakest.` : ""}`} />
            <p className="text-xs text-muted-foreground">Opening is done before the doors open, Closing after the last order, Manager is the hourly walk of the floor and Cash is the till counts.</p>
          </div>
        </section>
      </Card>

      <Card className="gap-3 p-6 shadow-sm">
        <section aria-label="Day by day">
          <div className="mb-3">
            <h2 className="text-base font-semibold">{selO !== null ? `${outletName(selO)}, each checklist day by day` : "Day by day, the twelve lowest outlets"}</h2>
            <p className="text-xs text-muted-foreground">
              {selO !== null ? "Look along a row for a checklist that slips on the same days." : "Look along a row for an outlet that keeps slipping and down a column for a day that went wrong everywhere. Click a name to look at that outlet."}
            </p>
          </div>
          <HeatGrid
            rows={heat}
            days={days}
            onPick={selO !== null ? undefined : pickOutlet}
            nameHead={selO !== null ? "Checklist" : "Outlet"}
            label={`${heat.length} ${selO !== null ? "checklists" : "outlets"} by ${days.length} days, each square showing the share of tasks done that day.`}
          />
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><i aria-hidden className="inline-block size-2.5 rounded-[3px] bg-success/30" /> {TARGET}% or more</span>
            <span className="flex items-center gap-1.5"><i aria-hidden className="inline-block size-2.5 rounded-[3px] bg-warning/60" /> 70% to {TARGET}%</span>
            <span className="flex items-center gap-1.5"><i aria-hidden className="inline-block size-2.5 rounded-[3px] bg-danger/70" /> Under 70%</span>
            <span className="flex items-center gap-1.5"><i aria-hidden className="inline-flex size-2.5 items-center justify-center rounded-[3px] bg-danger/80 text-[8px] leading-none font-bold">×</i> Not started</span>
            <span className="flex items-center gap-1.5"><i aria-hidden className="inline-block size-2.5 rounded-[3px] bg-muted/50 ring-1 ring-border" /> Not open</span>
          </p>
        </section>
      </Card>

      <Card className="gap-0 p-0 shadow-sm">
        <section aria-label="Trend" className="grid lg:grid-cols-12">
          <div className="flex min-w-0 flex-col gap-3 border-b p-6 lg:col-span-7 lg:border-r lg:border-b-0">
            <div>
              <h2 className="text-base font-semibold">Tasks done, day by day</h2>
              <p className="text-xs text-muted-foreground">{cap(scope)}. The line is the share of tasks done, the columns are checklists that were not started at all.</p>
            </div>
            <ComplianceTrend data={trend} label="Share of tasks done each day as a line against the target, with the checklists not started as columns." />
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><i aria-hidden className="inline-block h-0.5 w-4 rounded bg-primary" /> Tasks done</span>
              <span className="flex items-center gap-1.5"><i aria-hidden className="inline-block size-2.5 rounded-[3px] bg-muted-foreground/45" /> Checklists not started</span>
              <span className="flex items-center gap-1.5"><i aria-hidden className="inline-block h-0 w-4 border-t-2 border-dashed border-muted-foreground" /> Target</span>
            </p>
          </div>
          <div className="flex min-w-0 flex-col gap-3 p-6 lg:col-span-5">
            <div>
              <h2 className="text-base font-semibold">Tasks done, by day of the week</h2>
              <p className="text-xs text-muted-foreground">{lowDay ? `${lowDay.label} is the lowest at ${lowDay.pct.toFixed(1)}%. ` : ""}Busy days push the closing routine aside.</p>
            </div>
            <WeekdayBars data={weekday} label="Share of tasks done on each day of the week against the target." />
          </div>
        </section>
      </Card>

      <Card className="gap-0 p-0 shadow-sm">
        <section aria-label="Tasks and gaps" className="grid lg:grid-cols-12">
          <div className="flex min-w-0 flex-col gap-4 border-b p-6 lg:col-span-7 lg:border-r lg:border-b-0">
            <div>
              <h2 className="text-base font-semibold">Tasks left undone most often</h2>
              <p className="text-xs text-muted-foreground">{cap(scope)}, {pd.label}. How often each task was not ticked on the days the outlet was open.</p>
            </div>
            <ol className="flex flex-col gap-3" aria-label="Tasks left undone most often">
              {topMiss.map((m, i) => (
                <li key={m.type + m.name}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0">
                      <span className="mr-2 tabular-nums text-muted-foreground">{i + 1}</span>
                      <b className="font-medium">{m.name}</b>
                      <span className="ml-2 text-xs text-muted-foreground">{CTYPE_LABEL[m.type]}</span>
                    </span>
                    <span className="shrink-0 tabular-nums"><b className="font-semibold">{m.rate.toFixed(0)}%</b> <span className="text-muted-foreground">{m.missed.toLocaleString("en")} times</span></span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <i className={cn("block h-full rounded-full", i === 0 ? "bg-primary" : "bg-muted-foreground/60")} style={{ width: `${(m.rate / maxRate) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ol>
            <p className="text-xs text-muted-foreground">Photos, wastage and counts are skipped most, because they take the most effort. A task that is left undone almost everywhere is a problem with the task, not with one outlet.</p>
          </div>
          <div className="flex min-w-0 flex-col gap-4 p-6 lg:col-span-5">
            <div>
              <h2 className="text-base font-semibold">Checklists not started</h2>
              <p className="text-xs text-muted-foreground">The outlets with the most checklists skipped altogether. These are the ones to call.</p>
            </div>
            {skippers.length ? (
              <ul className="flex flex-col gap-2" aria-label="Outlets with the most checklists not started">
                {skippers.map((r) => (
                  <li key={r.o} className="flex items-baseline justify-between gap-3 text-sm tabular-nums">
                    <button type="button" onClick={() => setSelO(r.o)} aria-label={`Look at ${outletName(r.o)}`} className="min-w-0 truncate rounded text-left font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                      {outletName(r.o)} <span className="font-normal text-muted-foreground">{outletArea(r.o)}</span>
                    </button>
                    <span className="shrink-0"><b className="font-semibold">{r.a.notStarted}</b> <span className="text-muted-foreground">of {r.a.cells}</span></span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Every checklist was started.</p>
            )}
          </div>
        </section>
      </Card>

      <Card className="gap-0 p-0 shadow-sm">
        <div className="px-4 pt-4">
          <h2 className="text-base font-semibold">Checklists by outlet</h2>
          <p className="text-xs text-muted-foreground">Lowest first. The first figure follows the checklist filter, the four after it always show every checklist. Click an outlet name to look at it.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 px-4 pt-3 pb-3">
          <FilterSearch value={tq} onChange={setTq} placeholder="Search this table" />
          <FilterSelect boxed label="Tasks done" value={tstate} onChange={(v) => setTstate(v as TState)} options={T_STATE} />
          <FilterSelect boxed label="Not started" value={tstart} onChange={(v) => setTstart(v as TStart)} options={T_START} />
        </div>
        {tNarrowed ? (
          <div className="flex flex-wrap items-center gap-2 border-t px-4 py-3">
            {tq ? <Chip label={`Search: “${tq}”`} onClear={() => setTq("")} /> : null}
            {tstate !== "all" ? <Chip label={`Tasks done: ${T_STATE.find((o) => o.value === tstate)!.label}`} onClear={() => setTstate("all")} /> : null}
            {tstart !== "all" ? <Chip label="Not started: one or more" onClear={() => setTstart("all")} /> : null}
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={clearTable}>Clear all</Button>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t px-4 py-3">
          <p aria-live="polite" className="text-sm">
            <b className="text-base font-semibold tabular-nums">{tableRows.length} {tableRows.length === 1 ? "outlet" : "outlets"}</b>
            <span className="text-muted-foreground tabular-nums"> · {tableRows.filter((r) => pctOf(r.a) < TARGET).length} under {TARGET}%</span>
            {q ? <span className="text-muted-foreground"> · matching “{q.trim()}”</span> : null}
            {tq ? <span className="text-muted-foreground"> · in this table matching “{tq.trim()}”</span> : null}
          </p>
          {tNarrowed ? <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={clearTable}>Clear filters</Button> : null}
        </div>
        <div className="overflow-x-auto px-2 pb-2">
          <Table className="min-w-[860px]">
            <TableHeader>
              <TableRow>
                <SortHead label="Outlet" sortKey="name" sort={tv.sort} onSort={tv.toggleSort} className="text-left" />
                <SortHead label="Tasks done" sortKey="pct" sort={tv.sort} onSort={tv.toggleSort} className="text-right" />
                {CTYPES.map((t) => (
                  <SortHead key={t} label={CTYPE_LABEL[t]} sortKey={t} sort={tv.sort} onSort={tv.toggleSort} className="text-right" />
                ))}
                <SortHead label="Not started" sortKey="ns" sort={tv.sort} onSort={tv.toggleSort} className="text-right" />
                <SortHead label="Done late" sortKey="late" sort={tv.sort} onSort={tv.toggleSort} className="text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tv.rows.map((r) => (
                <TableRow key={r.o} className={cn(selO === r.o && "bg-muted/50")}>
                  <TableCell className="pl-3">
                    <button type="button" onClick={() => setSelO((s) => (s === r.o ? null : r.o))} aria-label={`Look at ${outletName(r.o)}`} className={cn("rounded text-left font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring", selO === r.o && "text-primary")}>
                      {outletName(r.o)}
                    </button>
                    <div className="text-xs text-muted-foreground">{outletArea(r.o)}</div>
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    <span className="inline-flex items-center gap-1.5">
                      {pctOf(r.a) < TARGET ? <i aria-hidden className="size-2 rounded-full bg-danger" /> : <i aria-hidden className="size-2" />}
                      {pctOf(r.a).toFixed(1)}%
                    </span>
                  </TableCell>
                  {CTYPES.map((t) => (
                    <TableCell key={t} className="text-right tabular-nums">{Math.round(pctOf(r.all.byType[t]))}%</TableCell>
                  ))}
                  <TableCell className="text-right tabular-nums">
                    <span className="inline-flex items-center gap-1.5">
                      {r.a.notStarted ? <i aria-hidden className="size-2 rounded-full bg-warning" /> : <i aria-hidden className="size-2" />}
                      {r.a.notStarted}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.a.late}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!tableRows.length ? (
            <div className="px-4 py-12 text-center">
              <p className="font-semibold">No outlets match these filters</p>
              <Button variant="outline" className="mt-4" onClick={clearTable}>Clear filters</Button>
            </div>
          ) : null}
        </div>
        <TablePagination view={tv} noun="outlets" note={`Tasks done is the tasks ticked out of the tasks expected. Under the target means below ${TARGET}%. Not started is a checklist with nothing ticked for a day.`} />
      </Card>

      <Card className="gap-3 p-6 shadow-sm">
        <div>
          <h2 className="text-base font-semibold">What this page is built on</h2>
          <p className="text-xs text-muted-foreground">The Treeams upload only gives tasks done out of tasks expected for each outlet and checklist. The rest of this page needs a richer export.</p>
        </div>
        <ul className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          {[
            ["Tasks done out of expected, for each outlet and checklist", "In the Treeams report that is uploaded today", true],
            ["The day each checklist was done", "Needs one row for each outlet, checklist and day, not the total for the period", false],
            ["The name of each task", "Needs the task rows of the Treeams export, to show which tasks are skipped", false],
            ["When each checklist was ticked", "Needs the time of the tick, to tell done on time from done late", false],
            ["Who completed it", "Needs the staff name on each checklist, to follow up with a person", false],
            ["Photos and notes", "Needs the photo link on the tasks that ask for one", false],
          ].map(([k, v, ok]) => (
            <li key={String(k)} className="flex gap-2">
              <i aria-hidden className={cn("mt-1.5 size-2 shrink-0 rounded-full", ok ? "bg-success" : "bg-muted-foreground/40")} />
              <span>
                <b className="font-medium">{k}</b> <span className="text-muted-foreground">· {v}</span>
                {!ok ? <span className="ml-1.5 text-xs text-muted-foreground">Planned</span> : null}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
