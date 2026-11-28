"use client";

import { ArrowLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { fmtDelta, fmtFull } from "@/components/drill-chart";
import { FilterSelect } from "@/components/filter-select";
import { Kpis } from "@/components/kpi-strip";
import { PageHeader } from "@/components/page-header";
import { OutletScatter, PnlStatement, PnlTrend, PurchasesVsUsed, Waterfall } from "@/components/pnl-parts";
import type { Dot } from "@/components/pnl-parts";
import { Chip, FilterBar, FilterSearch } from "@/components/sales-ui";
import { SortHead, TablePagination } from "@/components/table-parts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { useTableView } from "@/hooks/use-table-view";
import { PERIODS, REGION_LABEL, periodOf } from "@/lib/overview-mock";
import type { PeriodKey } from "@/lib/overview-mock";
import type { Region } from "@/lib/outlet-locations";
import { BASIS_LABEL, costOf, grossOf, marginOf, pnlOne, pnlTrend, pnlView } from "@/lib/pnl-mock";
import type { Basis, OutletPnl } from "@/lib/pnl-mock";
import { cn } from "@/lib/utils";

const pc = (v: number, of: number) => (of ? `${((v / of) * 100).toFixed(1)}%` : "0%");
// An outlet needs a look when it keeps this many points less of each ringgit than the whole network.
const FLAG_POINTS = 2;

type TMargin = "all" | "above" | "below";
type TFlag = "all" | "flag";
const T_MARGIN: { value: TMargin; label: string }[] = [
  { value: "all", label: "Any" },
  { value: "above", label: "Above network" },
  { value: "below", label: "Below network" },
];
const T_FLAG: { value: TFlag; label: string }[] = [
  { value: "all", label: "Any" },
  { value: "flag", label: "Needs a look" },
];
const BASIS_OPTIONS: { value: Basis; label: string }[] = [
  { value: "grn", label: BASIS_LABEL.grn },
  { value: "used", label: BASIS_LABEL.used },
];

export default function ProfitAndLoss() {
  const [period, setPeriod] = useState<PeriodKey>("mtd");
  const [region, setRegion] = useState<"all" | Region>("all");
  const [q, setQ] = useState("");
  const [basis, setBasis] = useState<Basis>("grn");
  const [outlet, setOutlet] = useState<string | null>(null);
  const [tq, setTq] = useState("");
  const [tmargin, setTmargin] = useState<TMargin>("all");
  const [tflag, setTflag] = useState<TFlag>("all");

  const pd = periodOf(period);
  const view = useMemo(() => pnlView(region, period, q), [region, period, q]);
  const one = useMemo(() => (outlet ? pnlOne(outlet, period) : null), [outlet, period]);
  const p = one ? one.p : view.total;
  const prev = one ? one.prev : view.prevTotal;
  const names = useMemo(() => (outlet ? [outlet] : view.rows.map((r) => r.name)), [outlet, view]);
  const trend = useMemo(() => pnlTrend(names, basis), [names, basis]);

  const netMargin = marginOf(view.total, basis) * 100;
  const margin = marginOf(p, basis) * 100;
  const prevMargin = prev ? marginOf(prev, basis) * 100 : null;
  const gp = grossOf(p, basis);
  const cost = costOf(p, basis);
  const rowMargin = (r: OutletPnl) => marginOf(r.p, basis) * 100;
  const flagged = (r: OutletPnl) => rowMargin(r) <= netMargin - FLAG_POINTS;

  // Outlets that keep the least of each ringgit, and why: fees or food.
  const watch = useMemo(() => {
    const feePct = view.total.sales ? view.total.fees.total / view.total.sales : 0;
    const costPct = view.total.sales ? costOf(view.total, basis) / view.total.sales : 0;
    return view.rows
      .filter(flagged)
      .sort((a, b) => rowMargin(a) - rowMargin(b))
      .slice(0, 6)
      .map((r) => {
        const f = r.p.fees.total / r.p.sales;
        const c = costOf(r.p, basis) / r.p.sales;
        const feeWorse = f - feePct > c - costPct;
        return { r, reason: feeWorse ? `Platform fees ${(f * 100).toFixed(1)}% of sales (network ${(feePct * 100).toFixed(1)}%)` : `Cost of food ${(c * 100).toFixed(1)}% of sales (network ${(costPct * 100).toFixed(1)}%)` };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, basis]);
  const flaggedCount = view.rows.filter(flagged).length;

  const dots: Dot[] = view.rows.map((r) => ({ name: r.name, area: r.area, sales: r.p.sales, margin: rowMargin(r), gp: grossOf(r.p, basis), flag: flagged(r) }));

  // Rank of one outlet in its region, for the line under the title when an outlet is open.
  const rank = useMemo(() => {
    if (!outlet) return null;
    const all = pnlView(region, period, "").rows.sort((a, b) => grossOf(b.p, basis) - grossOf(a.p, basis));
    return { n: all.length, i: all.findIndex((r) => r.name === outlet) + 1 };
  }, [outlet, region, period, basis]);

  // The table narrows its own rows, on top of the filters at the head of the page.
  const tNarrowed = !!tq || tmargin !== "all" || tflag !== "all";
  const clearTable = () => {
    setTq("");
    setTmargin("all");
    setTflag("all");
  };
  const tableRows = useMemo(() => {
    if (!tNarrowed) return view.rows;
    const needle = tq.trim().toLowerCase();
    return view.rows.filter((r) => (!needle || (r.name + " " + r.area).toLowerCase().includes(needle)) && (tmargin === "all" || (tmargin === "above" ? rowMargin(r) >= netMargin : rowMargin(r) < netMargin)) && (tflag === "all" || flagged(r)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, tNarrowed, tq, tmargin, tflag, basis, netMargin]);
  const tv = useTableView(tableRows, {
    pageSize: 10,
    resetKey: `${period}|${region}|${q}|${basis}|${tq}|${tmargin}|${tflag}`,
    sorts: { name: (r) => r.name, sales: (r) => r.p.sales, fees: (r) => r.p.fees.total, cost: (r) => costOf(r.p, basis), gp: (r) => grossOf(r.p, basis), margin: (r) => rowMargin(r) },
  });

  const reset = () => {
    setPeriod("mtd");
    setRegion("all");
    setQ("");
    setBasis("grn");
  };

  const gap = p.grn - p.used;
  const scopeName = outlet ?? (region === "all" ? "all outlets" : REGION_LABEL[region]);
  const salesDelta = prev && prev.sales ? p.sales / prev.sales - 1 : null;
  const pointsDelta = prevMargin !== null ? margin - prevMargin : null;

  return (
    <>
      <PageHeader
        title="Profit & loss"
        subtitle={
          <>
            What the sales leave after platform fees and the cost of food.{" "}
            <span className="ml-1 rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-foreground">Sample data</span>
          </>
        }
      />

      {outlet ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <nav aria-label="Path" className="flex flex-wrap items-center gap-1.5 text-sm">
            <Button variant="outline" size="sm" onClick={() => setOutlet(null)} aria-label="Back to all outlets">
              <ArrowLeft aria-hidden /> Back
            </Button>
            <ol className="flex flex-wrap items-center gap-1.5">
              <li>
                <button type="button" onClick={() => setOutlet(null)} className="rounded text-muted-foreground outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                  All outlets
                </button>
              </li>
              <li aria-hidden className="text-muted-foreground"><ChevronRight className="size-3.5" /></li>
              <li aria-current="page" className="font-semibold">{outlet}</li>
            </ol>
          </nav>
          {rank ? <p className="text-sm text-muted-foreground">Number {rank.i} of {rank.n} outlets by gross profit. Margin {margin.toFixed(1)}%, the network {netMargin.toFixed(1)}%.</p> : null}
        </div>
      ) : null}

      <FilterBar
        active={[
          ...(period !== "mtd" ? [{ key: "period", label: `Period: ${pd.label}`, onClear: () => setPeriod("mtd") }] : []),
          ...(region !== "all" ? [{ key: "region", label: `Region: ${REGION_LABEL[region]}`, onClear: () => setRegion("all") }] : []),
          ...(q ? [{ key: "q", label: `Outlet: “${q}”`, onClear: () => setQ("") }] : []),
          ...(basis !== "grn" ? [{ key: "basis", label: `Cost of food: ${BASIS_LABEL[basis]}`, onClear: () => setBasis("grn") }] : []),
        ]}
        onClearAll={reset}
        summary={`${outlet ? outlet : `${view.rows.length} outlets`} · ${pd.label} · cost of food is ${BASIS_LABEL[basis].toLowerCase()}`}
      >
        <FilterSearch value={q} onChange={setQ} placeholder="Search outlets" />
        <FilterSelect boxed label="Period" value={period} onChange={setPeriod} options={PERIODS.map((x) => ({ value: x.key, label: x.label }))} />
        <FilterSelect boxed label="Region" value={region} onChange={(v) => setRegion(v as "all" | Region)} options={[{ value: "all", label: "All regions" }, ...(Object.keys(REGION_LABEL) as Region[]).map((r) => ({ value: r, label: REGION_LABEL[r] }))]} />
        <FilterSelect boxed label="Cost of food" value={basis} onChange={setBasis} options={BASIS_OPTIONS} />
      </FilterBar>

      <section aria-label="Summary">
        <Kpis
          label="Profit and loss summary"
          columns={4}
          stacked
          kpis={[
            { key: "sales", count: fmtFull("sales", p.sales), label: `net sales${salesDelta !== null ? ` · ${fmtDelta(salesDelta)} vs ${pd.prevLabel}` : ""}`, note: `Net sales of ${scopeName}, ${pd.label}.` },
            { key: "fees", count: fmtFull("sales", p.fees.total), label: `platform fees · ${pc(p.fees.total, p.sales)} of net sales`, note: "Commission, advertising, service fees, payment gateway and adjustments on the delivery platforms and the app." },
            { key: "cost", count: fmtFull("sales", cost), label: `cost of food · ${pc(cost, p.sales)} of net sales`, note: `${BASIS_LABEL[basis]}. Change the basis in the filters.` },
            { key: "gp", count: fmtFull("sales", gp), label: `gross profit · margin ${margin.toFixed(1)}%${pointsDelta !== null ? ` (${pointsDelta >= 0 ? "+" : "−"}${Math.abs(pointsDelta).toFixed(1)} points)` : ""}`, note: "Net sales less platform fees less the cost of food. Labour, rent and other costs are not in it yet.", tone: pointsDelta !== null && pointsDelta < -2 ? "danger" : undefined },
          ]}
        />
      </section>

      <Card className="gap-0 p-0 shadow-sm">
        <section aria-label="Statement" className="grid lg:grid-cols-12">
          <div className="flex min-w-0 flex-col gap-3 border-b p-6 lg:col-span-7 lg:border-r lg:border-b-0">
            <div>
              <h2 className="text-base font-semibold">Profit and loss statement</h2>
              <p className="text-xs text-muted-foreground">{scopeName[0].toUpperCase() + scopeName.slice(1)}, {pd.label}. Open net sales, platform fees or the cost of food to see what they are made of.</p>
            </div>
            <PnlStatement p={p} prev={prev} basis={basis} />
          </div>
          <div className="flex min-w-0 flex-col gap-3 p-6 lg:col-span-5">
            <div>
              <h2 className="text-base font-semibold">Where the sales go</h2>
              <p className="text-xs text-muted-foreground">In ringgit. From net sales down through fees and the cost of food to gross profit.</p>
            </div>
            <Waterfall
              label={`Net sales ${fmtFull("sales", p.sales)}, platform fees ${fmtFull("sales", p.fees.total)}, cost of food ${fmtFull("sales", cost)}, gross profit ${fmtFull("sales", gp)}.`}
              steps={[
                { name: "Net sales", amount: p.sales, kind: "start", fill: "var(--muted-foreground)", opacity: 0.7 },
                { name: "Platform fees", amount: p.fees.total, kind: "less", fill: "var(--primary)", opacity: 0.55 },
                { name: "Cost of food", amount: cost, kind: "less", fill: "var(--primary)", opacity: 1 },
                { name: "Gross profit", amount: gp, kind: "end", fill: "var(--foreground)", opacity: 0.75 },
              ]}
            />
          </div>
        </section>
      </Card>

      <Card className="gap-0 p-0 shadow-sm">
        <section aria-label="Trend and purchases" className="grid lg:grid-cols-12">
          <div className="flex min-w-0 flex-col gap-3 border-b p-6 lg:col-span-6 lg:border-r lg:border-b-0">
            <div>
              <h2 className="text-base font-semibold">Gross profit through the year</h2>
              <p className="text-xs text-muted-foreground">A day on average in each month, and the margin as a line.</p>
            </div>
            <PnlTrend data={trend} label="Gross profit a day by month, with the margin as a line." />
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><i aria-hidden className="inline-block size-2.5 rounded-[3px] bg-primary/85" /> Gross profit a day</span>
              <span className="flex items-center gap-1.5"><i aria-hidden className="inline-block h-0.5 w-4 rounded bg-foreground" /> Margin</span>
            </p>
          </div>
          <div className="flex min-w-0 flex-col gap-3 p-6 lg:col-span-6">
            <div>
              <h2 className="text-base font-semibold">Purchases against food used</h2>
              <p className="text-xs text-muted-foreground">
                {Math.abs(gap) < 1 ? "Purchases and food used are level this period." : `This period purchases are ${fmtFull("sales", Math.abs(gap))} ${gap > 0 ? "higher" : "lower"} than food used, so stock ${gap > 0 ? "built up" : "ran down"}.`} A day on average.
              </p>
            </div>
            <PurchasesVsUsed data={trend} label="Purchases on the GRN against food used, a day on average, by month." />
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><i aria-hidden className="inline-block size-2.5 rounded-[3px] bg-muted-foreground/55" /> Purchases (GRN)</span>
              <span className="flex items-center gap-1.5"><i aria-hidden className="inline-block size-2.5 rounded-[3px] bg-primary" /> Food used (stock count)</span>
            </p>
          </div>
        </section>
      </Card>

      {!outlet ? (
        <>
          <Card className="gap-0 p-0 shadow-sm">
            <section aria-label="Outlets" className="grid lg:grid-cols-12">
              <div className="flex min-w-0 flex-col gap-3 border-b p-6 lg:col-span-7 lg:border-r lg:border-b-0">
                <div>
                  <h2 className="text-base font-semibold">Net sales against margin, by outlet</h2>
                  <p className="text-xs text-muted-foreground">Every outlet is a dot. The dashed line is the margin of the whole network ({netMargin.toFixed(1)}%). Click a dot to open that outlet.</p>
                </div>
                <OutletScatter dots={dots} network={netMargin} onPick={setOutlet} label={`Net sales against gross margin for ${dots.length} outlets. Network margin ${netMargin.toFixed(1)} percent. ${flaggedCount} outlets need a look.`} />
                <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><i aria-hidden className="inline-block size-2.5 rounded-full bg-primary" /> Needs a look</span>
                  <span className="flex items-center gap-1.5"><i aria-hidden className="inline-block size-2.5 rounded-full bg-muted-foreground/55" /> Other outlets</span>
                  <span className="flex items-center gap-1.5"><i aria-hidden className="inline-block h-0 w-4 border-t-2 border-dashed border-muted-foreground" /> Network margin</span>
                </p>
              </div>
              <div className="flex min-w-0 flex-col gap-3 p-6 lg:col-span-5">
                <div>
                  <h2 className="text-base font-semibold">Needs a look</h2>
                  <p className="text-xs text-muted-foreground">{flaggedCount} {flaggedCount === 1 ? "outlet keeps" : "outlets keep"} {FLAG_POINTS} points or more less of each ringgit than the network. The lowest first, and what is behind it.</p>
                </div>
                {watch.length ? (
                  <ol className="flex flex-col">
                    {watch.map(({ r, reason }) => (
                      <li key={r.name}>
                        <button type="button" onClick={() => setOutlet(r.name)} className="-mx-2 flex w-[calc(100%+1rem)] items-start justify-between gap-3 rounded-lg px-2 py-2 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
                          <span className="min-w-0">
                            <span className="block text-sm font-medium">{r.name}</span>
                            <span className="block text-xs text-muted-foreground">{reason}</span>
                          </span>
                          <span className="shrink-0 text-right text-sm tabular-nums">
                            <b className="font-semibold">{rowMargin(r).toFixed(1)}%</b>
                            <span className="block text-xs text-muted-foreground">{fmtFull("sales", grossOf(r.p, basis))}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="py-6 text-sm text-muted-foreground">No outlet is {FLAG_POINTS} points or more below the network margin.</p>
                )}
              </div>
            </section>
          </Card>

          <Card className="gap-0 p-0 shadow-sm">
            <div className="px-4 pt-4">
              <h2 className="text-base font-semibold">Profit and loss by outlet</h2>
              <p className="text-xs text-muted-foreground">Ten outlets a page. Click a row to open that outlet.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 px-4 pt-3 pb-3">
              <FilterSearch value={tq} onChange={setTq} placeholder="Search this table" />
              <FilterSelect boxed label="Margin" value={tmargin} onChange={setTmargin} options={T_MARGIN} />
              <FilterSelect boxed label="Watch" value={tflag} onChange={setTflag} options={T_FLAG} />
            </div>
            {tNarrowed ? (
              <div className="flex flex-wrap items-center gap-2 border-t px-4 py-3">
                {tq ? <Chip label={`Search: “${tq}”`} onClear={() => setTq("")} /> : null}
                {tmargin !== "all" ? <Chip label={`Margin: ${T_MARGIN.find((o) => o.value === tmargin)!.label}`} onClear={() => setTmargin("all")} /> : null}
                {tflag !== "all" ? <Chip label="Watch: needs a look" onClear={() => setTflag("all")} /> : null}
                <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={clearTable}>Clear all</Button>
              </div>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t px-4 py-3">
              <p aria-live="polite" className="text-sm">
                <b className="text-base font-semibold tabular-nums">{tableRows.length} {tableRows.length === 1 ? "outlet" : "outlets"}</b>
                <span className="text-muted-foreground tabular-nums"> · gross profit {fmtFull("sales", tableRows.reduce((s, r) => s + grossOf(r.p, basis), 0))}</span>
                {q ? <span className="text-muted-foreground"> · matching “{q.trim()}”</span> : null}
                {tq ? <span className="text-muted-foreground"> · in this table matching “{tq.trim()}”</span> : null}
              </p>
              {tNarrowed ? <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={clearTable}>Clear filters</Button> : null}
            </div>
            <div className="overflow-x-auto px-2 pb-2">
              <Table className="min-w-[680px]">
                <TableHeader>
                  <TableRow>
                    <SortHead label="Outlet" sortKey="name" sort={tv.sort} onSort={tv.toggleSort} className="text-left" />
                    <SortHead label="Net sales" sortKey="sales" sort={tv.sort} onSort={tv.toggleSort} className="text-right" />
                    <SortHead label="Platform fees" sortKey="fees" sort={tv.sort} onSort={tv.toggleSort} className="text-right" />
                    <SortHead label="Cost of food" sortKey="cost" sort={tv.sort} onSort={tv.toggleSort} className="text-right" />
                    <SortHead label="Gross profit" sortKey="gp" sort={tv.sort} onSort={tv.toggleSort} className="text-right" />
                    <SortHead label="Margin" sortKey="margin" sort={tv.sort} onSort={tv.toggleSort} className="text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tv.rows.map((r) => (
                    <TableRow key={r.name} className="cursor-pointer" onClick={() => setOutlet(r.name)}>
                      <TableCell className="pl-3">
                        <button
                          type="button"
                          aria-label={`Open ${r.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setOutlet(r.name);
                          }}
                          className="rounded text-left font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {r.name}
                        </button>
                        <div className="text-xs text-muted-foreground">{r.area}</div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{fmtFull("sales", r.p.sales)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtFull("sales", r.p.fees.total)}<span className="block text-xs text-muted-foreground">{pc(r.p.fees.total, r.p.sales)}</span></TableCell>
                      <TableCell className="text-right tabular-nums">{fmtFull("sales", costOf(r.p, basis))}<span className="block text-xs text-muted-foreground">{pc(costOf(r.p, basis), r.p.sales)}</span></TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{fmtFull("sales", grossOf(r.p, basis))}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span className="inline-flex items-center gap-1.5">
                          {flagged(r) ? <i aria-hidden className="size-2 rounded-full bg-warning" /> : <i aria-hidden className="size-2" />}
                          {rowMargin(r).toFixed(1)}%
                        </span>
                        {flagged(r) ? <span className="block text-xs text-muted-foreground">Needs a look</span> : null}
                      </TableCell>
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
            <TablePagination view={tv} noun="outlets" note={`Margin is gross profit as a share of net sales. Needs a look means ${FLAG_POINTS} points or more below the network.`} />
          </Card>
        </>
      ) : null}

      <Card className="gap-3 p-6 shadow-sm">
        <div>
          <h2 className="text-base font-semibold">What this page is built on</h2>
          <p className="text-xs text-muted-foreground">Gross profit is not yet a full profit. These are the sources behind it and the ones still to come.</p>
        </div>
        <ul className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          {[
            ["Net sales", "POS and the delivery apps, 44 of 44 outlets", true],
            ["Platform fees", "Grab, ShopeeFood, FoodPanda and the payment gateway of the app", true],
            ["Purchases", "GRN, goods received at the PO price. It includes goods rejected for quality, and it is goods received, not goods used", true],
            ["Food used", "Stock count and stock movement, 44 of 44 outlets", true],
            ["Labour cost", "Needs the payroll report", false],
            ["Rent, utilities and other overheads", "Need the expense reports", false],
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
