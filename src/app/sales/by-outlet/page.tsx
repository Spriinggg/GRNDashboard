"use client";

import { ArrowLeft, ChevronRight, MousePointerClick } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DrillChart, fmtDelta, fmtFull } from "@/components/drill-chart";
import { PageHeader } from "@/components/page-header";
import { LINE_LEAD, LINE_REST, TrendLines } from "@/components/sales-charts";
import { SortHead, TablePagination } from "@/components/table-parts";
import { useTableView } from "@/hooks/use-table-view";
import { FilterSelect } from "@/components/filter-select";
import { Kpis } from "@/components/kpi-strip";
import { Chip, Delta, FilterBar, FilterSearch, Seg } from "@/components/sales-ui";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { IDEAL_FC, LAST_M, MONTHS, OUTLETS, PERIODS, REGION_LABEL, YEAR, dayLong, hourRows, monthRows, networkRows, outletRows, periodOf, trendRows } from "@/lib/overview-mock";
import type { Level, Metric, PeriodKey, Row } from "@/lib/overview-mock";
import type { Region } from "@/lib/outlet-locations";
import { cn } from "@/lib/utils";

type Path = { outlet?: string; month?: number; day?: number };
type Perf = "all" | "top10" | "bottom10" | "above" | "below";
type Fc = "all" | "over";

const NOUN: Record<Level, string> = { network: "outlet", outlet: "month", month: "day", day: "hour" };
const PLURAL: Record<Level, string> = { network: "outlets", outlet: "months", month: "days", day: "hours" };
const PERF: { value: Perf; label: string }[] = [
  { value: "all", label: "All outlets" },
  { value: "top10", label: "Top 10 only" },
  { value: "bottom10", label: "Bottom 10 only" },
  { value: "above", label: "Above average" },
  { value: "below", label: "Below average" },
];
const FC: { value: Fc; label: string }[] = [
  { value: "all", label: "Any" },
  { value: "over", label: `Over ideal (${IDEAL_FC}%)` },
];
// Filters that belong to the outlet table itself. They narrow the table only. The filters at the top of the page also
// change the figures and charts.
type TFc = "all" | "over" | "ok";
type TChange = "all" | "up" | "down";
type TVs = "all" | "above" | "below";
const T_FC: { value: TFc; label: string }[] = [
  { value: "all", label: "Any" },
  { value: "over", label: "Over ideal" },
  { value: "ok", label: "On target" },
];
const T_CHANGE: { value: TChange; label: string }[] = [
  { value: "all", label: "Any" },
  { value: "up", label: "Up" },
  { value: "down", label: "Down" },
];
const T_VS: { value: TVs; label: string }[] = [
  { value: "all", label: "Any" },
  { value: "above", label: "Above average" },
  { value: "below", label: "Below average" },
];
const MEASURE: { value: Metric; label: string }[] = [
  { value: "sales", label: "Sales (RM)" },
  { value: "pizzas", label: "Pizzas" },
];

function Fcost({ v }: { v: number | null }) {
  if (v === null) return <span className="text-muted-foreground">–</span>;
  // A dot only when the outlet is off target, so a column of green dots does not shout.
  const tone = v > IDEAL_FC + 2 ? "bg-danger" : v > IDEAL_FC ? "bg-warning" : null;
  return (
    <span className="inline-flex items-center gap-1.5 tabular-nums">
      {tone ? <i aria-hidden className={cn("size-2 rounded-full", tone)} /> : <i aria-hidden className="size-2" />}
      {v.toFixed(1)}%
    </span>
  );
}

export default function SalesByOutlet() {
  const [metric, setMetric] = useState<Metric>("sales");
  const [period, setPeriod] = useState<PeriodKey>("mtd");
  const [region, setRegion] = useState<"all" | Region>("all");
  const [q, setQ] = useState("");
  const [perf, setPerf] = useState<Perf>("all");
  const [fc, setFc] = useState<Fc>("all");
  const [path, setPath] = useState<Path>({});
  const [trendMode, setTrendMode] = useState<"top" | "total">("top");
  const [hot, setHot] = useState<string | null>(null);
  const [tq, setTq] = useState("");
  const [tfc, setTfc] = useState<TFc>("all");
  const [tchange, setTchange] = useState<TChange>("all");
  const [tvs, setTvs] = useState<TVs>("all");

  const level: Level = path.day !== undefined ? "day" : path.month !== undefined ? "month" : path.outlet ? "outlet" : "network";
  const depth = ["network", "outlet", "month", "day"].indexOf(level);
  const what = metric === "sales" ? "Net sales" : "Pizzas sold";
  const pd = periodOf(period);

  // Every outlet in the region and period, then the filters narrow it.
  const base = useMemo(() => networkRows(region, period, metric), [region, period, metric]);
  const network = useMemo(() => {
    const avg = base.length ? base.reduce((s, r) => s + r.value, 0) / base.length : 0;
    let r = base.filter((x) => !q || (x.label + " " + (x.sub ?? "")).toLowerCase().includes(q.toLowerCase()));
    if (fc === "over") r = r.filter((x) => x.fc !== null && x.fc > IDEAL_FC);
    if (perf === "above") r = r.filter((x) => x.value >= avg);
    if (perf === "below") r = r.filter((x) => x.value < avg);
    if (perf === "top10") r = r.slice(0, 10);
    if (perf === "bottom10") r = r.slice(-10);
    const total = r.reduce((s, x) => s + x.value, 0) || 1;
    return r.map((x) => ({ ...x, share: x.value / total }));
  }, [base, q, fc, perf]);

  const rows: Row[] = useMemo(() => {
    if (level === "network") return network;
    if (level === "outlet") return outletRows(path.outlet!, metric);
    if (level === "month") return monthRows(path.outlet!, path.month!, metric);
    return hourRows(path.outlet!, path.month!, path.day!, metric);
  }, [level, network, metric, path]);

  // Sorting and paging for the breakdown table. Without a sort the rows keep their order (largest first, or in time).
  // The table has its own search and filters, on top of the ones at the head of the page.
  const tNarrowed = !!tq || tfc !== "all" || tchange !== "all" || tvs !== "all";
  const clearTable = () => {
    setTq("");
    setTfc("all");
    setTchange("all");
    setTvs("all");
  };
  const tableRows = useMemo(() => {
    if (level !== "network" || !tNarrowed) return rows;
    const avg = rows.length ? rows.reduce((s, r) => s + r.value, 0) / rows.length : 0;
    const needle = tq.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (!needle || (r.label + " " + (r.sub ?? "")).toLowerCase().includes(needle)) &&
        (tfc === "all" || (r.fc !== null && (tfc === "over" ? r.fc > IDEAL_FC : r.fc <= IDEAL_FC))) &&
        (tchange === "all" || (r.delta !== null && (tchange === "up" ? r.delta >= 0 : r.delta < 0))) &&
        (tvs === "all" || (tvs === "above" ? r.value >= avg : r.value < avg)),
    );
  }, [level, tNarrowed, rows, tq, tfc, tchange, tvs]);
  const tableTotal = tableRows.reduce((s, r) => s + r.value, 0);
  const tv = useTableView(tableRows, {
    pageSize: 10,
    resetKey: `${level}|${path.outlet}|${path.month}|${path.day}|${period}|${region}|${q}|${perf}|${fc}|${metric}|${tq}|${tfc}|${tchange}|${tvs}`,
    sorts: {
      name: (r) => (level === "network" ? r.label : Number(r.key)),
      value: (r) => r.value,
      share: (r) => r.share,
      delta: (r) => r.delta ?? -1e9,
      fc: (r) => r.fc ?? -1,
    },
  });

  // Ten outlets a page. The months, days and hours below an outlet are short lists, so they show on one page.
  useEffect(() => {
    tv.setSize(level === "network" ? 10 : 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level]);

  const top10 = useMemo(() => network.slice(0, 10), [network]);
  const trend = useMemo(() => (level === "network" ? trendRows((trendMode === "top" ? top10 : network).map((r) => r.label), metric) : []), [level, trendMode, top10, network, metric]);

  const reset = () => {
    setPeriod("mtd");
    setRegion("all");
    setQ("");
    setPerf("all");
    setFc("all");
  };

  const up = () => setPath((p) => (p.day !== undefined ? { ...p, day: undefined } : p.month !== undefined ? { ...p, month: undefined } : {}));
  const goTo = (d: number) => setPath((p) => (d === 0 ? {} : d === 1 ? { outlet: p.outlet } : { outlet: p.outlet, month: p.month }));
  const pick = (key: string) => {
    setHot(null);
    if (level === "network") setPath({ outlet: key });
    else if (level === "outlet") setPath((p) => ({ ...p, month: +key }));
    else if (level === "month") setPath((p) => ({ ...p, day: +key }));
  };
  const canDrill = level !== "day";

  // Escape goes up one level, like a back button.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key === "Escape" && depth > 0 && !(t && /input|textarea|select/i.test(t.tagName))) up();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [depth]);

  const total = rows.reduce((s, r) => s + r.value, 0);
  const n = rows.length || 1;
  const best = rows.length ? rows.reduce((a, b) => (b.value > a.value ? b : a)) : null;
  const low = rows.length ? rows.reduce((a, b) => (b.value < a.value ? b : a)) : null;
  const fcs = rows.filter((r) => r.fc !== null && r.value > 0);
  const fcAvg = fcs.length ? fcs.reduce((s, r) => s + r.fc! * r.value, 0) / fcs.reduce((s, r) => s + r.value, 0) : null;

  const prevTotal = level === "network" && pd.prev ? rows.reduce((s, r) => s + (r.delta !== null ? r.value / (1 + r.delta) : 0), 0) : 0;
  const lastRow = rows[rows.length - 1];
  const totalSub =
    level === "network"
      ? pd.prev && prevTotal > 0
        ? `${fmtDelta(total / prevTotal - 1)} vs ${pd.prevLabel}`
        : `${rows.length} outlets`
      : level === "outlet"
        ? lastRow?.delta != null
          ? `${lastRow.label} ${fmtDelta(lastRow.delta)} vs ${MONTHS[LAST_M - 1]} (daily average)`
          : `${rows.length} months`
        : level === "month"
          ? `${rows.length} days`
          : `${rows.length} trading hours`;

  const crumbs = [
    { label: "All outlets", d: 0 },
    ...(path.outlet ? [{ label: path.outlet, d: 1 }] : []),
    ...(path.month !== undefined ? [{ label: `${MONTHS[path.month]} ${YEAR}`, d: 2 }] : []),
    ...(path.day !== undefined ? [{ label: dayLong(path.month!, path.day), d: 3 }] : []),
  ];

  const title =
    level === "network" ? `${what} by outlet` : level === "outlet" ? `${path.outlet}: ${what.toLowerCase()} by month` : level === "month" ? `${path.outlet}, ${MONTHS[path.month!]} ${YEAR}: by day` : `${path.outlet}, ${dayLong(path.month!, path.day!)}: by hour`;
  const hint =
    level === "network"
      ? `${region === "all" ? `${rows.length} outlets` : `${rows.length} ${REGION_LABEL[region]} outlets`} · ${pd.label}. Click a bar to open that outlet.`
      : level === "outlet"
        ? "Click a month to see its days."
        : level === "month"
          ? "Click a day to see its hours."
          : `Last level. Busiest hour is ${best?.label}.`;
  const legend: [string, string] | null = level === "outlet" ? ["Full month", "Month so far"] : level === "month" ? ["Weekend", "Weekday"] : level === "day" ? ["Peak hours", "Other hours"] : null;
  const compare = level === "network" ? `vs ${pd.prevLabel}` : level === "outlet" ? "vs previous month (daily avg)" : "vs same day last week";
  const hasFc = rows.some((r) => r.fc !== null);
  const hasDelta = rows.some((r) => r.delta !== null);

  return (
    <>
      <PageHeader
        title="Sales by outlet"
        subtitle={
          <>
            Compare outlets, then go deeper: outlet, month, day, hour.{" "}
            <span className="ml-1 rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-foreground">Sample data</span>
          </>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Drill-down path" className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm">
          {depth > 0 ? (
            <Button variant="outline" size="sm" onClick={up} aria-label="Back one level" title="Back (Esc)">
              <ArrowLeft aria-hidden /> Back
            </Button>
          ) : null}
          <ol className="flex flex-wrap items-center gap-1.5">
            {crumbs.map((c, i) => (
              <li key={c.d} className="inline-flex items-center gap-1.5">
                {i > 0 ? <ChevronRight aria-hidden className="size-3.5 text-muted-foreground" /> : null}
                {i === crumbs.length - 1 ? (
                  <span aria-current="page" className="font-semibold">{c.label}</span>
                ) : (
                  <button type="button" onClick={() => goTo(c.d)} className="rounded text-muted-foreground outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                    {c.label}
                  </button>
                )}
              </li>
            ))}
          </ol>
        </nav>
        {level !== "network" ? <FilterSelect boxed label="Measure" value={metric} onChange={setMetric} options={MEASURE} /> : null}
      </div>

      {level === "network" ? (
        <FilterBar
          active={[
            ...(period !== "mtd" ? [{ key: "period", label: `Period: ${pd.label}`, onClear: () => setPeriod("mtd") }] : []),
            ...(region !== "all" ? [{ key: "region", label: `Region: ${REGION_LABEL[region]}`, onClear: () => setRegion("all") }] : []),
            ...(perf !== "all" ? [{ key: "perf", label: `Ranking: ${PERF.find((p) => p.value === perf)!.label}`, onClear: () => setPerf("all") }] : []),
            ...(fc !== "all" ? [{ key: "fc", label: `Food cost: over ideal`, onClear: () => setFc("all") }] : []),
            ...(q ? [{ key: "q", label: `Outlet: “${q}”`, onClear: () => setQ("") }] : []),
          ]}
          onClearAll={reset}
          summary={`Showing ${rows.length} of ${OUTLETS.length} outlets · ${pd.label}`}
        >
          <FilterSearch value={q} onChange={setQ} placeholder="Search outlets" />
          <FilterSelect boxed label="Period" value={period} onChange={setPeriod} options={PERIODS.map((p) => ({ value: p.key, label: p.label }))} />
          <FilterSelect boxed label="Region" value={region} onChange={(v) => setRegion(v as "all" | Region)} options={[{ value: "all", label: "All regions" }, ...(Object.keys(REGION_LABEL) as Region[]).map((r) => ({ value: r, label: REGION_LABEL[r] }))]} />
          <FilterSelect boxed label="Ranking" value={perf} onChange={setPerf} options={PERF} />
          <FilterSelect boxed label="Food cost" value={fc} onChange={setFc} options={FC} />
          <FilterSelect boxed label="Measure" value={metric} onChange={setMetric} options={MEASURE} />
        </FilterBar>
      ) : null}

      <section aria-label="Summary">
        <Kpis
          label={`${what} summary`}
          columns={4}
          stacked
          kpis={[
            { key: "total", count: fmtFull(metric, total), label: `${what.toLowerCase()} · ${totalSub}`, note: level === "network" ? `${what}, ${region === "all" ? "selected outlets" : REGION_LABEL[region]}, ${pd.label}.` : `${what}, ${crumbs[crumbs.length - 1].label}.` },
            { key: "avg", count: fmtFull(metric, total / n), label: `average per ${NOUN[level]} · ${rows.length} ${rows.length === 1 ? NOUN[level] : PLURAL[level]}`, note: `The total divided by the number of ${PLURAL[level]} shown.` },
            { key: "best", count: best ? best.label : "–", label: best ? `best ${NOUN[level]} · ${fmtFull(metric, best.value)} · ${Math.round(best.share * 100)}%` : `best ${NOUN[level]}`, note: `The ${NOUN[level]} with the highest ${metric === "sales" ? "sales" : "pizzas"}.` },
            fcAvg !== null
              ? { key: "fc", count: `${fcAvg.toFixed(1)}%`, label: `food cost · ideal is ${IDEAL_FC}%${fcAvg > IDEAL_FC ? `, ${(fcAvg - IDEAL_FC).toFixed(1)} points above` : ""}`, note: "Food cost as a share of sales, weighted by sales.", tone: fcAvg > IDEAL_FC + 2 ? "danger" : fcAvg > IDEAL_FC ? "warning" : undefined }
              : { key: "low", count: low ? low.label : "–", label: low ? `lowest ${NOUN[level]} · ${fmtFull(metric, low.value)} · ${Math.round(low.share * 100)}%` : `lowest ${NOUN[level]}`, note: `The ${NOUN[level]} with the lowest ${metric === "sales" ? "sales" : "pizzas"}.` },
          ]}
        />
      </section>

      {level === "network" ? (
        <Card className="gap-0 p-0 shadow-sm">
        <section aria-label="Top outlets and trend" className="grid lg:grid-cols-12">
          <div className="flex flex-col gap-3 border-b p-6 lg:col-span-5 lg:border-r lg:border-b-0">
            <div>
              <h2 className="text-base font-semibold">Top 10 outlets</h2>
              <p className="text-xs text-muted-foreground">{what}, {pd.label}. Hover a row to find its line. Click to open.</p>
            </div>
            {top10.length ? (
              <ol className="flex flex-col">
                {top10.map((r, i) => (
                  <li key={r.key}>
                    <button
                      type="button"
                      onClick={() => pick(r.key)}
                      onMouseEnter={() => setHot(r.key)}
                      onMouseLeave={() => setHot(null)}
                      onFocus={() => setHot(r.key)}
                      onBlur={() => setHot(null)}
                      className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-lg px-2 py-1.5 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="w-5 text-right text-xs font-semibold text-muted-foreground tabular-nums">{i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{r.label}</span>
                        <span className="mt-1 block h-1 overflow-hidden rounded-full bg-muted">
                          <i className={cn("block h-full rounded-full", hot === r.key || (i === 0 && !hot) ? "bg-primary" : "bg-muted-foreground/50")} style={{ width: `${(r.value / top10[0].value) * 100}%` }} />
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="block text-sm font-semibold tabular-nums">{fmtFull(metric, r.value)}</span>
                        <span className="block text-xs"><Delta d={r.delta} /></span>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">No outlet matches the filters.</p>
            )}
          </div>
          <div className="flex flex-col gap-3 p-6 lg:col-span-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">{trendMode === "top" ? "Top 10 outlets through the year" : "All selected outlets through the year"}</h2>
                <p className="text-xs text-muted-foreground">Average {metric === "sales" ? "sales" : "pizzas"} per day in each month, January to {MONTHS[LAST_M]}. A part month is not drawn as a drop.</p>
              </div>
              <Seg<"top" | "total"> label="Lines" value={trendMode} onChange={setTrendMode} options={[{ value: "top", label: "Top 10" }, { value: "total", label: "Total" }]} />
            </div>
            {network.length ? (
              <>
                <TrendLines data={trend} keys={top10.map((r, i) => ({ key: r.label, color: i === 0 ? LINE_LEAD : LINE_REST }))} mode={trendMode} hot={hot} metric={metric} label={`Average daily ${what.toLowerCase()} by month, January to ${MONTHS[LAST_M]}.`} />
                <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {trendMode === "top" ? (
                    <>
                      <span className="flex items-center gap-1.5"><i aria-hidden className="inline-block h-0.5 w-4 rounded bg-primary" /> Top outlet, or the one you point at</span>
                      <span className="flex items-center gap-1.5"><i aria-hidden className="inline-block h-0.5 w-4 rounded bg-muted-foreground/60" /> Other top 10 outlets</span>
                    </>
                  ) : (
                    <span className="flex items-center gap-1.5"><i aria-hidden className="inline-block h-0.5 w-4 rounded bg-primary" /> All selected outlets</span>
                  )}
                </p>
              </>
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">Nothing to draw. Loosen the filters.</p>
            )}
          </div>
        </section>
        </Card>
      ) : null}

      {level !== "network" ? (
        <Card className="gap-3 p-6 shadow-sm">
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {canDrill ? <MousePointerClick aria-hidden className="size-3.5" /> : null}
              {hint}
            </p>
          </div>
          <DrillChart rows={rows} horizontal={false} metric={metric} avg={total / n} compare={compare} label={title} onPick={canDrill ? pick : undefined} />
          {legend ? (
            <p className="flex gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><i aria-hidden className="inline-block size-2.5 rounded-[3px] bg-primary" /> {legend[0]}</span>
              <span className="flex items-center gap-1.5"><i aria-hidden className="inline-block size-2.5 rounded-[3px] bg-primary/50" /> {legend[1]}</span>
            </p>
          ) : null}
        </Card>
      ) : null}

      <Card className="gap-0 p-0 shadow-sm">
        {level === "network" ? (
          <div className="px-4 pt-4">
            <h2 className="text-base font-semibold">All outlets: {what.toLowerCase()}</h2>
            <p className="text-xs text-muted-foreground">Ten outlets a page. The bar is the outlet against the biggest one. Click a row to open it.</p>
          </div>
        ) : null}
        {level === "network" ? (
          <>
            <div className="flex flex-wrap items-center gap-2 px-4 pt-3 pb-3">
              <FilterSearch value={tq} onChange={setTq} placeholder="Search this table" />
              <FilterSelect boxed label="Food cost" value={tfc} onChange={setTfc} options={T_FC} />
              <FilterSelect boxed label="Change" value={tchange} onChange={setTchange} options={T_CHANGE} />
              <FilterSelect boxed label="Against average" value={tvs} onChange={setTvs} options={T_VS} />
            </div>
            {tNarrowed ? (
              <div className="flex flex-wrap items-center gap-2 border-t px-4 py-3">
                {tq ? <Chip label={`Search: “${tq}”`} onClear={() => setTq("")} /> : null}
                {tfc !== "all" ? <Chip label={`Food cost: ${T_FC.find((o) => o.value === tfc)!.label}`} onClear={() => setTfc("all")} /> : null}
                {tchange !== "all" ? <Chip label={`Change: ${T_CHANGE.find((o) => o.value === tchange)!.label}`} onClear={() => setTchange("all")} /> : null}
                {tvs !== "all" ? <Chip label={`Against average: ${T_VS.find((o) => o.value === tvs)!.label}`} onClear={() => setTvs("all")} /> : null}
                <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={clearTable}>
                  Clear all
                </Button>
              </div>
            ) : null}
          </>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t px-4 py-3">
          <p aria-live="polite" className="text-sm">
            <b className="text-base font-semibold tabular-nums">
              {tableRows.length} {tableRows.length === 1 ? NOUN[level] : PLURAL[level]}
            </b>
            <span className="text-muted-foreground tabular-nums"> · {fmtFull(metric, tableTotal)}</span>
            {q ? <span className="text-muted-foreground"> · matching “{q.trim()}”</span> : null}
            {tq ? <span className="text-muted-foreground"> · in this table matching “{tq.trim()}”</span> : null}
            {canDrill ? <span className="text-muted-foreground"> · click a row to open it</span> : null}
          </p>
          {level === "network" && tNarrowed ? (
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={clearTable}>
              Clear filters
            </Button>
          ) : null}
        </div>
        <div className="overflow-x-auto px-2 pb-2">
          <Table className="min-w-[560px]">
            <TableHeader>
              <TableRow>
                <SortHead label={NOUN[level][0].toUpperCase() + NOUN[level].slice(1)} sortKey="name" sort={tv.sort} onSort={tv.toggleSort} className="text-left" />
                <SortHead label={metric === "sales" ? "Sales" : "Pizzas"} sortKey="value" sort={tv.sort} onSort={tv.toggleSort} className="text-right" />
                <SortHead label="Share" sortKey="share" sort={tv.sort} onSort={tv.toggleSort} className="hidden w-[22%] md:table-cell" />
                {hasDelta ? <SortHead label="Change" sortKey="delta" sort={tv.sort} onSort={tv.toggleSort} className="text-right" /> : null}
                {hasFc ? <SortHead label="Food cost" sortKey="fc" sort={tv.sort} onSort={tv.toggleSort} className="text-right" /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {tv.rows.map((r) => (
                <TableRow key={r.key} className={canDrill ? "cursor-pointer" : undefined} onClick={canDrill ? () => pick(r.key) : undefined}>
                  <TableCell className="pl-3">
                    {canDrill ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          pick(r.key);
                        }}
                        className="rounded text-left font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={`Open ${r.label}`}
                      >
                        {level === "month" ? `${r.sub} ${r.label}` : r.label}
                      </button>
                    ) : (
                      <span className="font-medium">{r.label}</span>
                    )}
                    {r.sub && level !== "month" ? <div className="text-xs text-muted-foreground">{r.sub}</div> : null}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{fmtFull(metric, r.value)}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <i className="block h-full rounded-full bg-primary" style={{ width: `${Math.max((r.value / (best?.value || 1)) * 100, 2)}%` }} />
                      </div>
                      <span className="w-9 text-right text-xs text-muted-foreground tabular-nums">{(r.share * 100).toFixed(1)}%</span>
                    </div>
                  </TableCell>
                  {hasDelta ? <TableCell className="text-right"><Delta d={r.delta} /></TableCell> : null}
                  {hasFc ? <TableCell className="text-right"><Fcost v={r.fc} /></TableCell> : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!tableRows.length ? (
            <div className="px-4 py-12 text-center">
              <p className="font-semibold">No outlets match these filters</p>
              <Button variant="outline" className="mt-4" onClick={clearTable}>
                Clear filters
              </Button>
            </div>
          ) : null}
        </div>
        <TablePagination view={tv} noun={PLURAL[level]} note={hasDelta ? `Change is ${compare}.` : undefined} />
      </Card>
    </>
  );
}
