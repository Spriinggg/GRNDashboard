"use client";

import { ArrowLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { fmtDelta } from "@/components/drill-chart";
import { FilterSelect } from "@/components/filter-select";
import { Kpis } from "@/components/kpi-strip";
import { HourChart, LabourBars, LabourScatter, LabourTrend, WeekdayBars } from "@/components/labour-charts";
import type { LabourDot, LabourRow } from "@/components/labour-charts";
import { PageHeader } from "@/components/page-header";
import { Chip, FilterBar, FilterSearch } from "@/components/sales-ui";
import { SortHead, TablePagination } from "@/components/table-parts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { useTableView } from "@/hooks/use-table-view";
import { LPERIODS, OT_HIGH, ROLES, ROLE_LABEL, TARGET, aggregate, byDay, byHour, byWeekday, labourGrid, lPeriodOf, otPct, outletArea, outletName, pctOf, perHour, regionOf } from "@/lib/labour-mock";
import type { Agg, Role } from "@/lib/labour-mock";
import { OUTLETS, REGION_LABEL } from "@/lib/overview-mock";
import type { Region } from "@/lib/outlet-locations";
import { cn } from "@/lib/utils";

const rm = (v: number) => `RM ${Math.round(v).toLocaleString("en")}`;

type TState = "all" | "over" | "within";
type TOt = "all" | "high";
const T_STATE: { value: TState; label: string }[] = [
  { value: "all", label: "Any" },
  { value: "over", label: `Over ${TARGET}%` },
  { value: "within", label: `${TARGET}% or under` },
];
const T_OT: { value: TOt; label: string }[] = [
  { value: "all", label: "Any" },
  { value: "high", label: `${OT_HIGH}% or more` },
];
const ROLE_OPTIONS: { value: "all" | Role; label: string }[] = [{ value: "all", label: "All roles" }, ...ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))];

type Row = { o: number; a: Agg };

export default function LabourVsSales() {
  const [period, setPeriod] = useState("mtd");
  const [region, setRegion] = useState<"all" | Region>("all");
  const [role, setRole] = useState<"all" | Role>("all");
  const [q, setQ] = useState("");
  // Selecting an outlet makes the whole page about it.
  const [selO, setSelO] = useState<number | null>(null);
  const [tq, setTq] = useState("");
  const [tstate, setTstate] = useState<TState>("all");
  const [tot, setTot] = useState<TOt>("all");

  const pd = lPeriodOf(period);
  const g = useMemo(() => labourGrid(pd.ranges), [pd]);
  const pg = useMemo(() => labourGrid(pd.prev), [pd]);
  const roles = useMemo<Role[]>(() => (role === "all" ? ROLES : [role]), [role]);
  const needle = q.trim().toLowerCase();

  // Every outlet the filters let through, with its own totals.
  const rows: Row[] = useMemo(
    () =>
      OUTLETS.map((_, o) => o)
        .filter((o) => (region === "all" || regionOf(o) === region) && (!needle || (outletName(o) + " " + outletArea(o)).toLowerCase().includes(needle)))
        .map((o) => ({ o, a: aggregate(g, [o], roles) }))
        .filter((r) => r.a.days > 0),
    [g, roles, region, needle],
  );
  const pool = useMemo(() => rows.map((r) => r.o), [rows]);
  const focus = useMemo(() => (selO !== null ? [selO] : pool), [selO, pool]);
  const a = useMemo(() => aggregate(g, focus, roles), [g, focus, roles]);
  const prev = useMemo(() => aggregate(pg, focus, roles), [pg, focus, roles]);
  const net = useMemo(() => aggregate(g, pool, roles), [g, pool, roles]);

  const pct = pctOf(a);
  const costDelta = prev.cost ? a.cost / prev.cost - 1 : null;
  const perDelta = prev.sales && prev.hours ? perHour(a) / perHour(prev) - 1 : null;
  const scope = selO !== null ? outletName(selO) : region === "all" ? "all outlets" : REGION_LABEL[region];

  const trend = useMemo(() => byDay(g, focus, roles), [g, focus, roles]);
  const weekday = useMemo(() => byWeekday(g, focus, roles), [g, focus, roles]);
  const hours = useMemo(() => byHour(g, pd.ranges, focus, roles), [g, pd, focus, roles]);
  const short = hours.filter((h) => h.verdict === "short").map((h) => h.label);
  const many = hours.filter((h) => h.verdict === "many").map((h) => h.label);

  // The bars: the outlets with the highest labour share, and the one chosen if it is not among them.
  const barRows: LabourRow[] = useMemo(() => {
    const all = [...rows].sort((x, y) => pctOf(y.a) - pctOf(x.a));
    const top = all.slice(0, 10);
    if (selO !== null && !top.some((r) => r.o === selO)) {
      const r = all.find((x) => x.o === selO);
      if (r) top.push(r);
    }
    return top.map((r) => ({ key: String(r.o), name: outletName(r.o), sub: outletArea(r.o), pct: pctOf(r.a), selected: selO === r.o, tip: [["Labour cost", rm(r.a.cost)], ["Net sales", rm(r.a.sales)], ["Sales for each hour", rm(perHour(r.a))], ["Overtime", `${otPct(r.a).toFixed(1)}% of hours`]] }));
  }, [rows, selO]);
  const over = rows.filter((r) => pctOf(r.a) > TARGET).length;

  const dots: LabourDot[] = rows.map((r) => ({ name: outletName(r.o), area: outletArea(r.o), sales: r.a.sales, pct: pctOf(r.a), cost: r.a.cost, over: pctOf(r.a) > TARGET }));
  const rank = selO !== null ? { i: [...rows].sort((x, y) => pctOf(y.a) - pctOf(x.a)).findIndex((r) => r.o === selO) + 1, n: rows.length } : null;

  // The table narrows its own rows, on top of the filters at the head of the page.
  const tNarrowed = !!tq || tstate !== "all" || tot !== "all";
  const clearTable = () => {
    setTq("");
    setTstate("all");
    setTot("all");
  };
  const tableRows = useMemo(() => {
    const t = tq.trim().toLowerCase();
    return rows.filter((r) => (!t || (outletName(r.o) + " " + outletArea(r.o)).toLowerCase().includes(t)) && (tstate === "all" || (tstate === "over" ? pctOf(r.a) > TARGET : pctOf(r.a) <= TARGET)) && (tot === "all" || otPct(r.a) >= OT_HIGH)).sort((x, y) => pctOf(y.a) - pctOf(x.a));
  }, [rows, tq, tstate, tot]);
  const tv = useTableView(tableRows, {
    pageSize: 10,
    resetKey: `${period}|${region}|${role}|${q}|${tq}|${tstate}|${tot}`,
    sorts: { name: (r) => outletName(r.o), sales: (r) => r.a.sales, cost: (r) => r.a.cost, pct: (r) => pctOf(r.a), hours: (r) => r.a.hours, per: (r) => perHour(r.a), ot: (r) => otPct(r.a), heads: (r) => (r.a.days ? r.a.hours / 8 / r.a.days : 0) },
  });

  const reset = () => {
    setPeriod("mtd");
    setRegion("all");
    setRole("all");
    setQ("");
    setSelO(null);
  };
  const pick = (k: string) => setSelO((s) => (s === +k ? null : +k));
  const parts: [string, number][] = [["Regular wages", a.regular], ["Overtime", a.ot], ["Allowances", a.allow], ["Employer contributions", a.employer]];

  return (
    <>
      <PageHeader
        title="Labour vs sales"
        subtitle={
          <>
            How much of sales goes to labour, and whether the crew fits the day.{" "}
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
          {rank ? <p className="text-sm text-muted-foreground">Number {rank.i} of {rank.n} outlets by labour share. {pct.toFixed(1)}%, all outlets {pctOf(net).toFixed(1)}%.</p> : null}
        </div>
      ) : null}

      <FilterBar
        active={[
          ...(period !== "mtd" ? [{ key: "period", label: `Period: ${pd.label}`, onClear: () => setPeriod("mtd") }] : []),
          ...(region !== "all" ? [{ key: "region", label: `Region: ${REGION_LABEL[region]}`, onClear: () => setRegion("all") }] : []),
          ...(role !== "all" ? [{ key: "role", label: `Role: ${ROLE_LABEL[role]}`, onClear: () => setRole("all") }] : []),
          ...(q ? [{ key: "q", label: `Outlet: “${q}”`, onClear: () => setQ("") }] : []),
        ]}
        onClearAll={reset}
        summary={`${selO !== null ? outletName(selO) : `${rows.length} outlets`} · ${pd.label} · ${role === "all" ? "all roles" : ROLE_LABEL[role].toLowerCase()}`}
      >
        <FilterSearch value={q} onChange={setQ} placeholder="Search outlets" />
        <FilterSelect boxed label="Period" value={period} onChange={setPeriod} options={LPERIODS.map((p) => ({ value: p.key, label: p.label }))} />
        <FilterSelect boxed label="Region" value={region} onChange={(v) => setRegion(v as "all" | Region)} options={[{ value: "all", label: "All regions" }, ...(Object.keys(REGION_LABEL) as Region[]).map((r) => ({ value: r, label: REGION_LABEL[r] }))]} />
        <FilterSelect boxed label="Role" value={role} onChange={setRole} options={ROLE_OPTIONS} />
      </FilterBar>

      <section aria-label="Summary">
        <Kpis
          label="Labour summary"
          columns={4}
          stacked
          kpis={[
            { key: "cost", count: rm(a.cost), label: `labour cost${costDelta !== null ? ` · ${fmtDelta(costDelta)} vs ${pd.prevLabel}` : ""}`, note: `Wages, overtime, allowances and the contributions the employer adds, ${pd.label}, ${scope}.` },
            { key: "pct", count: `${pct.toFixed(1)}%`, label: `of net sales · target under ${TARGET}%`, note: `Labour cost as a share of net sales. ${over} of ${rows.length} outlets are over the target.`, tone: pct > TARGET + 3 ? "danger" : pct > TARGET ? "warning" : undefined },
            { key: "per", count: rm(perHour(a)), label: `sales for each hour worked${perDelta !== null ? ` · ${fmtDelta(perDelta)}` : ""}`, note: "Net sales divided by the hours the crew worked. The higher it is, the harder each hour works." },
            { key: "ot", count: `${otPct(a).toFixed(1)}%`, label: `of hours are overtime · ${OT_HIGH}% is high`, note: "Overtime hours as a share of all hours worked. Overtime is paid at one and a half times.", tone: otPct(a) >= OT_HIGH ? "warning" : undefined },
          ]}
        />
      </section>

      <Card className="gap-0 p-0 shadow-sm">
        <section aria-label="Outlets" className="grid lg:grid-cols-12">
          <div className="flex min-w-0 flex-col gap-3 border-b p-6 lg:col-span-6 lg:border-r lg:border-b-0">
            <div>
              <h2 className="text-base font-semibold">Labour share, by outlet</h2>
              <p className="text-xs text-muted-foreground">The ten outlets where labour takes the biggest share of sales. {over} of {rows.length} are over the {TARGET}% target. Click one to look at it.</p>
            </div>
            <LabourBars rows={barRows} hasSelection={selO !== null} onPick={pick} label={`Labour as a share of net sales for the ten highest outlets. ${over} of ${rows.length} outlets are over the ${TARGET} percent target.`} />
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><i aria-hidden className="inline-block size-2.5 rounded-[3px] bg-primary/90" /> Over the target</span>
              <span className="flex items-center gap-1.5"><i aria-hidden className="inline-block size-2.5 rounded-[3px] bg-muted-foreground/60" /> Within the target</span>
              <span className="flex items-center gap-1.5"><i aria-hidden className="inline-block h-0 w-4 border-t-2 border-dashed border-muted-foreground" /> Target</span>
            </p>
          </div>
          <div className="flex min-w-0 flex-col gap-3 p-6 lg:col-span-6">
            <div>
              <h2 className="text-base font-semibold">Net sales against labour share</h2>
              <p className="text-xs text-muted-foreground">Every outlet is a dot. High and to the left is a small outlet whose crew costs a lot for what it sells. Click a dot to open that outlet.</p>
            </div>
            <LabourScatter dots={dots} onPick={(n) => setSelO(OUTLETS.findIndex((o) => o.name === n))} label={`Net sales against labour share for ${dots.length} outlets. ${over} are over the ${TARGET} percent target.`} />
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><i aria-hidden className="inline-block size-2.5 rounded-full bg-primary" /> Over the target</span>
              <span className="flex items-center gap-1.5"><i aria-hidden className="inline-block size-2.5 rounded-full bg-muted-foreground/55" /> Within the target</span>
            </p>
          </div>
        </section>
      </Card>

      <Card className="gap-0 p-0 shadow-sm">
        <section aria-label="Days" className="grid lg:grid-cols-12">
          <div className="flex min-w-0 flex-col gap-3 border-b p-6 lg:col-span-7 lg:border-r lg:border-b-0">
            <div>
              <h2 className="text-base font-semibold">Labour cost, day by day</h2>
              <p className="text-xs text-muted-foreground">{scope[0].toUpperCase() + scope.slice(1)}. Columns are what the crew cost, the line is that as a share of the day&apos;s sales.</p>
            </div>
            <LabourTrend data={trend} label="Labour cost each day with its share of the day's sales as a line against the target." />
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><i aria-hidden className="inline-block size-2.5 rounded-[3px] bg-muted-foreground/55" /> Labour cost</span>
              <span className="flex items-center gap-1.5"><i aria-hidden className="inline-block h-0.5 w-4 rounded bg-primary" /> Share of sales</span>
              <span className="flex items-center gap-1.5"><i aria-hidden className="inline-block h-0 w-4 border-t-2 border-dashed border-muted-foreground" /> Target</span>
            </p>
          </div>
          <div className="flex min-w-0 flex-col gap-3 p-6 lg:col-span-5">
            <div>
              <h2 className="text-base font-semibold">Labour share, by day of the week</h2>
              <p className="text-xs text-muted-foreground">The crew is much the same every day and sales are not, so the quiet days run high.</p>
            </div>
            <WeekdayBars data={weekday} label="Labour share of net sales on each day of the week against the target." />
          </div>
        </section>
      </Card>

      <Card className="gap-0 p-0 shadow-sm">
        <section aria-label="Hours and cost" className="grid lg:grid-cols-12">
          <div className="flex min-w-0 flex-col gap-3 border-b p-6 lg:col-span-7 lg:border-r lg:border-b-0">
            <div>
              <h2 className="text-base font-semibold">Staff against sales, hour by hour</h2>
              <p className="text-xs text-muted-foreground">
                An average day for one outlet. {short.length ? `Short of staff at ${short.join(", ")}.` : "No hour is short of staff."} {many.length ? `Too many staff at ${many.join(", ")}.` : "No hour has too many."}
              </p>
            </div>
            <HourChart data={hours} label={`Sales and staff on shift for each hour. Short of staff at ${short.join(", ") || "no hour"}. Too many staff at ${many.join(", ") || "no hour"}.`} />
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><i aria-hidden className="inline-block size-2.5 rounded-[3px] bg-primary/90" /> Short of staff</span>
              <span className="flex items-center gap-1.5"><i aria-hidden className="inline-block size-2.5 rounded-[3px] bg-muted-foreground/60" /> About right</span>
              <span className="flex items-center gap-1.5"><i aria-hidden className="inline-block size-2.5 rounded-[3px] bg-muted-foreground/30" /> Too many staff</span>
              <span className="flex items-center gap-1.5"><i aria-hidden className="inline-block h-0.5 w-4 rounded bg-foreground" /> Staff on shift</span>
            </p>
          </div>
          <div className="flex min-w-0 flex-col gap-4 p-6 lg:col-span-5">
            <div>
              <h2 className="text-base font-semibold">Where the labour money goes</h2>
              <p className="text-xs text-muted-foreground">{rm(a.cost)}, {pd.label}.</p>
            </div>
            <ul className="flex flex-col gap-3" aria-label="Labour cost by part">
              {parts.map(([k, v], i) => (
                <li key={k}>
                  <div className="flex items-baseline justify-between gap-3 text-sm tabular-nums">
                    <span>{k}</span>
                    <span><b className="font-semibold">{rm(v)}</b> <span className="text-muted-foreground">{a.cost ? Math.round((v / a.cost) * 100) : 0}%</span></span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <i className="block h-full rounded-full bg-primary" style={{ width: `${a.cost ? (v / a.cost) * 100 : 0}%`, opacity: [1, 0.7, 0.45, 0.3][i] }} />
                  </div>
                </li>
              ))}
            </ul>
            <div>
              <h3 className="mb-2 text-sm font-semibold">By role</h3>
              <ul className="flex flex-col gap-2" aria-label="Labour cost by role">
                {ROLES.map((r) => (
                  <li key={r} className="flex items-baseline justify-between gap-3 text-sm tabular-nums">
                    <span>{ROLE_LABEL[r]}</span>
                    <span><b className="font-semibold">{rm(a.byRole[r].cost)}</b> <span className="text-muted-foreground">{Math.round(a.byRole[r].hours).toLocaleString("en")} hours</span></span>
                  </li>
                ))}
              </ul>
              {role !== "all" ? <p className="mt-2 text-xs text-muted-foreground">Figures above are for {ROLE_LABEL[role].toLowerCase()} only. The share of sales is that role&apos;s share.</p> : null}
            </div>
          </div>
        </section>
      </Card>

      <Card className="gap-0 p-0 shadow-sm">
        <div className="px-4 pt-4">
          <h2 className="text-base font-semibold">Labour by outlet</h2>
          <p className="text-xs text-muted-foreground">Highest labour share first. Click an outlet name to look at it.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 px-4 pt-3 pb-3">
          <FilterSearch value={tq} onChange={setTq} placeholder="Search this table" />
          <FilterSelect boxed label="Labour share" value={tstate} onChange={setTstate} options={T_STATE} />
          <FilterSelect boxed label="Overtime" value={tot} onChange={setTot} options={T_OT} />
        </div>
        {tNarrowed ? (
          <div className="flex flex-wrap items-center gap-2 border-t px-4 py-3">
            {tq ? <Chip label={`Search: “${tq}”`} onClear={() => setTq("")} /> : null}
            {tstate !== "all" ? <Chip label={`Labour share: ${T_STATE.find((o) => o.value === tstate)!.label}`} onClear={() => setTstate("all")} /> : null}
            {tot !== "all" ? <Chip label={`Overtime: ${T_OT.find((o) => o.value === tot)!.label}`} onClear={() => setTot("all")} /> : null}
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={clearTable}>Clear all</Button>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t px-4 py-3">
          <p aria-live="polite" className="text-sm">
            <b className="text-base font-semibold tabular-nums">{tableRows.length} {tableRows.length === 1 ? "outlet" : "outlets"}</b>
            <span className="text-muted-foreground tabular-nums"> · labour {rm(tableRows.reduce((s, r) => s + r.a.cost, 0))}</span>
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
                <SortHead label="Net sales" sortKey="sales" sort={tv.sort} onSort={tv.toggleSort} className="text-right" />
                <SortHead label="Labour cost" sortKey="cost" sort={tv.sort} onSort={tv.toggleSort} className="text-right" />
                <SortHead label="Labour share" sortKey="pct" sort={tv.sort} onSort={tv.toggleSort} className="text-right" />
                <SortHead label="Hours" sortKey="hours" sort={tv.sort} onSort={tv.toggleSort} className="text-right" />
                <SortHead label="Sales per hour" sortKey="per" sort={tv.sort} onSort={tv.toggleSort} className="text-right" />
                <SortHead label="Overtime" sortKey="ot" sort={tv.sort} onSort={tv.toggleSort} className="text-right" />
                <SortHead label="Crew a day" sortKey="heads" sort={tv.sort} onSort={tv.toggleSort} className="text-right" />
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
                  <TableCell className="text-right tabular-nums">{rm(r.a.sales)}</TableCell>
                  <TableCell className="text-right tabular-nums">{rm(r.a.cost)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    <span className="inline-flex items-center gap-1.5">
                      {pctOf(r.a) > TARGET ? <i aria-hidden className="size-2 rounded-full bg-danger" /> : <i aria-hidden className="size-2" />}
                      {pctOf(r.a).toFixed(1)}%
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{Math.round(r.a.hours).toLocaleString("en")}</TableCell>
                  <TableCell className="text-right tabular-nums">{rm(perHour(r.a))}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span className="inline-flex items-center gap-1.5">
                      {otPct(r.a) >= OT_HIGH ? <i aria-hidden className="size-2 rounded-full bg-warning" /> : <i aria-hidden className="size-2" />}
                      {otPct(r.a).toFixed(1)}%
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.a.days ? (r.a.hours / 8 / r.a.days).toFixed(1) : "–"}</TableCell>
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
        <TablePagination view={tv} noun="outlets" note={`Labour share is labour cost as a share of net sales. Over the target means above ${TARGET}%. Overtime is high from ${OT_HIGH}% of hours.`} />
      </Card>

      <Card className="gap-3 p-6 shadow-sm">
        <div>
          <h2 className="text-base font-semibold">What this page is built on</h2>
          <p className="text-xs text-muted-foreground">Labour needs reports that are not in the system yet. These are the sources behind the page and the ones still to come.</p>
        </div>
        <ul className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          {[
            ["Net sales", "POS and the delivery apps, every day, 44 of 44 outlets", true],
            ["Hours worked, pay rates and overtime", "Need the payroll or roster report, one row for each person and day", false],
            ["Roles", "Kitchen, counter and delivery. Need the role on each payroll line", false],
            ["Sales in each hour", "Needs the POS export of sales by hour", false],
            ["Staff on shift in each hour", "Needs the roster with shift start and end times", false],
            ["Labour target", `${TARGET}% of net sales for now. To be set for each outlet`, false],
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
        <p className="text-xs text-muted-foreground">When the payroll report is added, the Labour cost line on the Profit &amp; loss page fills in and operating profit appears.</p>
      </Card>
    </>
  );
}
