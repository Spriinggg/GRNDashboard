"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { fmtDelta } from "@/components/drill-chart";
import { FilterSelect } from "@/components/filter-select";
import { Kpis } from "@/components/kpi-strip";
import { PageHeader } from "@/components/page-header";
import { Chip, FilterBar, FilterSearch } from "@/components/sales-ui";
import { SortHead, TablePagination } from "@/components/table-parts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { DayTrend, ShortBars } from "@/components/variance-charts";
import type { DayPoint, ShortRow } from "@/components/variance-charts";
import { useTableView } from "@/hooks/use-table-view";
import { OUTLETS, REGION_LABEL, sumDays } from "@/lib/overview-mock";
import type { Region } from "@/lib/outlet-locations";
import { CRIT_RM, ITEMS, PATTERN_LABEL, SHORT_RM, VPERIODS, buildGrid, foodCostOf, outletArea, outletName, regionOf, vPeriodOf } from "@/lib/variance-mock";
import { signTone } from "@/lib/calc";
import type { Cat, Cell, Pattern } from "@/lib/variance-mock";
import { cn } from "@/lib/utils";

const rm = (v: number) => `RM ${Math.round(v).toLocaleString("en")}`;
const signed = (v: number) => `${v < 0 ? "−" : ""}${rm(Math.abs(v))}`;
const cap = (s: string) => s[0] + s.slice(1).toLowerCase();

type TPat = "all" | Pattern;
type TSize = "all" | "crit";
const T_PAT: { value: TPat; label: string }[] = [
  { value: "all", label: "Any" },
  { value: "repeat", label: "Repeated" },
  { value: "some", label: "Occasional" },
  { value: "clear", label: "Clear" },
];
const T_SIZE: { value: TSize; label: string }[] = [
  { value: "all", label: "Any" },
  { value: "crit", label: `A day ${rm(CRIT_RM)} or more short` },
];
const CATS: { value: "all" | Cat; label: string }[] = [
  { value: "all", label: "All" },
  { value: "FOOD", label: "Food" },
  { value: "PACKAGING", label: "Packaging" },
];
const PAT_RANK: Record<Pattern, number> = { repeat: 0, some: 1, clear: 2 };

function PatternMark({ p }: { p: Pattern }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {p === "repeat" ? <i aria-hidden className="size-2 rounded-full bg-danger" /> : p === "some" ? <i aria-hidden className="size-2 rounded-full bg-warning" /> : <i aria-hidden className="size-2" />}
      <span className={p === "clear" ? "text-muted-foreground" : undefined}>{PATTERN_LABEL[p]}</span>
    </span>
  );
}

export default function FoodVariance() {
  const [period, setPeriod] = useState("mtd");
  const [region, setRegion] = useState<"all" | Region>("all");
  const [cat, setCat] = useState<"all" | Cat>("all");
  const [q, setQ] = useState("");
  // Selecting an outlet or an item filters the rest of the page, in either order.
  const [selO, setSelO] = useState<number | null>(null);
  const [selI, setSelI] = useState<number | null>(null);
  const [tq, setTq] = useState("");
  const [tpat, setTpat] = useState<TPat>("all");
  const [tsize, setTsize] = useState<TSize>("all");

  const pd = vPeriodOf(period);
  const grid = useMemo(() => buildGrid(pd.ranges), [pd]);
  const prevGrid = useMemo(() => buildGrid(pd.prev), [pd]);
  const needle = q.trim().toLowerCase();
  const keep = (c: Cell) => (region === "all" || regionOf(c.o) === region) && (cat === "all" || ITEMS[c.i].cat === cat) && (!needle || (outletName(c.o) + " " + outletArea(c.o) + " " + ITEMS[c.i].name).toLowerCase().includes(needle));
  const base = useMemo(() => grid.cells.filter(keep), [grid, region, cat, needle]); // eslint-disable-line react-hooks/exhaustive-deps
  const prevBase = useMemo(() => prevGrid.cells.filter(keep), [prevGrid, region, cat, needle]); // eslint-disable-line react-hooks/exhaustive-deps
  const inSel = (c: Cell) => (selO === null || c.o === selO) && (selI === null || c.i === selI);
  const focus = useMemo(() => base.filter(inSel), [base, selO, selI]); // eslint-disable-line react-hooks/exhaustive-deps
  const prevFocus = useMemo(() => prevBase.filter(inSel), [prevBase, selO, selI]); // eslint-disable-line react-hooks/exhaustive-deps

  const sum = (cs: Cell[], f: (c: Cell) => number) => cs.reduce((s, c) => s + f(c), 0);
  const outletsIn = (cs: Cell[]) => [...new Set(cs.map((c) => c.o))];
  const net = sum(focus, (c) => c.net);
  const short = sum(focus, (c) => c.short);
  const prevShort = sum(prevFocus, (c) => c.short);
  const repeat = focus.filter((c) => c.pattern === "repeat").length;
  const os = outletsIn(focus);
  const sales = os.reduce((s, o) => s + grid.sales[o], 0);
  const foodNet = sum(focus.filter((c) => ITEMS[c.i].cat === "FOOD"), (c) => c.net);
  const points = sales ? (-foodNet / sales) * 100 : 0;
  const actualFc = sales ? os.reduce((s, o) => s + foodCostOf(o, pd.ranges) * grid.sales[o], 0) / sales : 0;
  const shortDelta = prevShort ? short / prevShort - 1 : null;

  // The outlets, worst first, for the items chosen. The item chosen is not applied to the outlet chart's own bars.
  const outletRows: ShortRow[] = useMemo(() => {
    const m = new Map<number, { short: number; net: number; repeat: number; ds: number; days: number }>();
    for (const c of base.filter((x) => selI === null || x.i === selI)) {
      const e = m.get(c.o) ?? { short: 0, net: 0, repeat: 0, ds: 0, days: 0 };
      e.short += c.short;
      e.net += c.net;
      e.repeat += c.pattern === "repeat" ? 1 : 0;
      e.ds += c.daysShort;
      e.days += c.days;
      m.set(c.o, e);
    }
    const all = [...m.entries()].sort((a, b) => b[1].short - a[1].short);
    const top = all.slice(0, 10);
    if (selO !== null && !top.some(([o]) => o === selO)) {
      const e = all.find(([o]) => o === selO);
      if (e) top.push(e);
    }
    return top.map(([o, e]) => ({ key: String(o), name: outletName(o), sub: outletArea(o), value: e.short, text: rm(e.short), selected: selO === o, tip: [["Short", rm(e.short)], ["Net of what was over", signed(e.net)], ["Repeated shortages", String(e.repeat)], ["Item-days short", `${e.ds} of ${e.days}`]] }));
  }, [base, selI, selO]);

  // The items, worst first, for the outlet chosen, with how much of the total each one makes up.
  const itemRows: ShortRow[] = useMemo(() => {
    const m = new Map<number, { short: number; net: number; outlets: number; ds: number; days: number }>();
    for (const c of base.filter((x) => selO === null || x.o === selO)) {
      const e = m.get(c.i) ?? { short: 0, net: 0, outlets: 0, ds: 0, days: 0 };
      e.short += c.short;
      e.net += c.net;
      e.outlets += c.daysShort > 0 ? 1 : 0;
      e.ds += c.daysShort;
      e.days += c.days;
      m.set(c.i, e);
    }
    const all = [...m.entries()].sort((a, b) => b[1].short - a[1].short);
    const total = all.reduce((s, [, e]) => s + e.short, 0) || 1;
    let cum = 0;
    const top = all.slice(0, 12).map((x) => {
      cum += x[1].short;
      return { x, cum };
    });
    if (selI !== null && !top.some(({ x }) => x[0] === selI)) {
      const x = all.find((y) => y[0] === selI);
      if (x) top.push({ x, cum: 0 });
    }
    return top.map(({ x: [i, e], cum: c }) => ({ key: String(i), name: ITEMS[i].name, sub: `${ITEMS[i].code} · ${cap(ITEMS[i].cat)}`, value: e.short, text: `${rm(e.short)}${c ? ` · ${Math.round((c / total) * 100)}%` : ""}`, selected: selI === i, tip: [["Short", rm(e.short)], ["Share of all shortage", `${Math.round((e.short / total) * 100)}%`], ["Outlets short on it", String(e.outlets)], ["Item-days short", `${e.ds} of ${e.days}`]] }));
  }, [base, selO, selI]);
  const topShare = useMemo(() => {
    const t = itemRows.reduce((s, r) => s + r.value, 0);
    const all = base.filter((x) => selO === null || x.o === selO).reduce((s, c) => s + c.short, 0) || 1;
    return Math.round((t / all) * 100);
  }, [itemRows, base, selO]);

  // Day by day for what is chosen.
  const trend: DayPoint[] = useMemo(() => {
    const sel = outletsIn(focus);
    return grid.days.map((day, k) => {
      let s = 0, n = 0;
      for (const c of focus) {
        const v = c.vals[k];
        if (v === null) continue;
        n += v;
        if (v < 0) s -= v;
      }
      const dayCounted = sel.reduce((a, o) => a + sumDays(OUTLETS[o], day.m, day.d, day.d), 0);
      return { label: day.label, sub: day.sub, short: s, net: n, pct: dayCounted ? (s / dayCounted) * 100 : 0 };
    });
  }, [focus, grid]);

  // Are the numbers fit to trust? Days without a stock count give no variance at all, and days without a GRN or a POS deduction give a less reliable one.
  const trust = useMemo(() => {
    const rows = grid.trust.filter((t, o) => (region === "all" || regionOf(o) === region) && (!needle || (t.name + " " + t.area).toLowerCase().includes(needle) || ITEMS.some((it) => it.name.toLowerCase().includes(needle))));
    const days = rows.reduce((s, t) => s + t.days, 0);
    const complete = rows.reduce((s, t) => s + t.complete, 0);
    return { rows: rows.filter((t) => t.complete < t.days).sort((a, b) => a.complete / a.days - b.complete / b.days).slice(0, 6), pct: days ? Math.round((complete / days) * 100) : 100, gaps: rows.filter((t) => t.complete < t.days).length, n: rows.length };
  }, [grid, region, needle]);

  // The table narrows its own rows, on top of the filters at the head of the page.
  const tNarrowed = !!tq || tpat !== "all" || tsize !== "all";
  const clearTable = () => {
    setTq("");
    setTpat("all");
    setTsize("all");
  };
  const tableRows = useMemo(() => {
    const t = tq.trim().toLowerCase();
    return focus
      .filter((c) => (tpat === "all" || c.pattern === tpat) && (tsize === "all" || c.vals.some((v) => v !== null && v <= -CRIT_RM)) && (!t || (outletName(c.o) + " " + ITEMS[c.i].name + " " + ITEMS[c.i].code).toLowerCase().includes(t)))
      .sort((a, b) => a.net - b.net);
  }, [focus, tq, tpat, tsize]);
  const tv = useTableView(tableRows, {
    pageSize: 10,
    resetKey: `${period}|${region}|${cat}|${q}|${selO}|${selI}|${tq}|${tpat}|${tsize}`,
    sorts: { item: (c) => ITEMS[c.i].name, outlet: (c) => outletName(c.o), days: (c) => c.daysShort / c.days, net: (c) => c.net, last: (c) => c.last?.varq ?? 0, pattern: (c) => PAT_RANK[c.pattern] },
  });

  const reset = () => {
    setPeriod("mtd");
    setRegion("all");
    setCat("all");
    setQ("");
    setSelO(null);
    setSelI(null);
  };
  const pickO = (k: string) => setSelO((s) => (s === +k ? null : +k));
  const pickI = (k: string) => setSelI((s) => (s === +k ? null : +k));
  const pair = selO !== null && selI !== null && focus.length === 1 ? focus[0] : null;
  const scope = selO !== null ? outletName(selO) : region === "all" ? "all outlets" : REGION_LABEL[region];

  return (
    <>
      <PageHeader
        title="Food variance"
        subtitle={
          <>
            What the count found against what the system expects, across the outlets. Click an outlet or an item to look at it.{" "}
            <span className="ml-1 rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-foreground">Sample data</span>
          </>
        }
      />
      <p className="-mt-3 text-sm text-muted-foreground">
        Looking for the real count of one outlet and one day, item by item? Open{" "}
        <Link href="/variance/day" className="font-medium text-primary underline-offset-2 hover:underline">
          One outlet and day
        </Link>
        .
      </p>

      <FilterBar
        active={[
          ...(selO !== null ? [{ key: "so", label: `Outlet: ${outletName(selO)}`, onClear: () => setSelO(null) }] : []),
          ...(selI !== null ? [{ key: "si", label: `Item: ${ITEMS[selI].name}`, onClear: () => setSelI(null) }] : []),
          ...(period !== "mtd" ? [{ key: "period", label: `Period: ${pd.label}`, onClear: () => setPeriod("mtd") }] : []),
          ...(region !== "all" ? [{ key: "region", label: `Region: ${REGION_LABEL[region]}`, onClear: () => setRegion("all") }] : []),
          ...(cat !== "all" ? [{ key: "cat", label: `Category: ${CATS.find((c) => c.value === cat)!.label}`, onClear: () => setCat("all") }] : []),
          ...(q ? [{ key: "q", label: `Search: “${q}”`, onClear: () => setQ("") }] : []),
        ]}
        onClearAll={reset}
        summary={`${scope} · ${pd.label} · ${focus.length} outlet and item pairs counted`}
      >
        <FilterSearch value={q} onChange={setQ} placeholder="Search outlets or items" />
        <FilterSelect boxed label="Period" value={period} onChange={setPeriod} options={VPERIODS.map((p) => ({ value: p.key, label: p.label }))} />
        <FilterSelect boxed label="Region" value={region} onChange={(v) => setRegion(v as "all" | Region)} options={[{ value: "all", label: "All regions" }, ...(Object.keys(REGION_LABEL) as Region[]).map((r) => ({ value: r, label: REGION_LABEL[r] }))]} />
        <FilterSelect boxed label="Category" value={cat} onChange={(v) => setCat(v as "all" | Cat)} options={CATS} />
      </FilterBar>

      <section aria-label="Summary">
        <Kpis
          label="Food variance summary"
          columns={4}
          stacked
          kpis={[
            { key: "short", count: rm(short), label: `short${shortDelta !== null ? ` · ${fmtDelta(shortDelta)} vs ${pd.prevLabel}` : ""}`, note: `The value of what the count found under what the system expects, ${pd.label}, ${scope}. Counted days only.` },
            { key: "net", count: signed(net), label: "net variance · after what was over", note: "Short less over. This is what the stock is really down by." },
            { key: "repeat", count: String(repeat), label: `repeated shortages · of ${focus.length} pairs`, note: `An outlet and item that was short by ${rm(SHORT_RM)} or more on at least 3 days and on at least 40% of the days counted. One bad count is likely a mistake, many are likely a loss.`, tone: repeat ? "danger" : undefined },
            { key: "fc", count: `${actualFc.toFixed(1)}%`, label: `food cost · ${points.toFixed(1)} points above ideal`, note: "Food cost as a share of sales, and how many points of it the shortage explains (food items only).", tone: points > 3 ? "danger" : points > 1.5 ? "warning" : undefined },
          ]}
        />
      </section>

      <Card className="gap-0 p-0 shadow-sm">
        <section aria-label="Outlets and items" className="grid lg:grid-cols-12">
          <div className="flex min-w-0 flex-col gap-3 border-b p-6 lg:col-span-6 lg:border-r lg:border-b-0">
            <div>
              <h2 className="text-base font-semibold">Short, by outlet</h2>
              <p className="text-xs text-muted-foreground">{selI !== null ? `Only ${ITEMS[selI].name}. ` : ""}The ten outlets that were short the most. Click one to look at it.</p>
            </div>
            <ShortBars rows={outletRows} hasSelection={selO !== null} onPick={pickO} noun="outlet" label={`Value short by outlet. Largest is ${outletRows[0]?.name ?? "none"}.`} />
          </div>
          <div className="flex min-w-0 flex-col gap-3 p-6 lg:col-span-6">
            <div>
              <h2 className="text-base font-semibold">Short, by item</h2>
              <p className="text-xs text-muted-foreground">{selO !== null ? `Only ${outletName(selO)}. ` : ""}The items that were short the most, with their running share of all the shortage. These {Math.min(itemRows.length, 12)} make up {topShare}%.</p>
            </div>
            <ShortBars rows={itemRows} hasSelection={selI !== null} onPick={pickI} noun="item" label={`Value short by item. Largest is ${itemRows[0]?.name ?? "none"}.`} />
          </div>
        </section>
      </Card>

      <Card className="gap-0 p-0 shadow-sm">
        <section aria-label="Trend and trust" className="grid lg:grid-cols-12">
          <div className="flex min-w-0 flex-col gap-3 border-b p-6 lg:col-span-7 lg:border-r lg:border-b-0">
            <div>
              <h2 className="text-base font-semibold">{pair ? `${ITEMS[pair.i].name} at ${outletName(pair.o)}` : "Short, day by day"}</h2>
              <p className="text-xs text-muted-foreground">
                {pair
                  ? `Short on ${pair.daysShort} of ${pair.days} days counted. Last count: expected ${pair.last?.sys} ${ITEMS[pair.i].uom}, counted ${pair.last?.phys} ${ITEMS[pair.i].uom}.`
                  : `${scope[0].toUpperCase() + scope.slice(1)}${selI !== null ? `, ${ITEMS[selI].name}` : ""}. Columns are what was short, the line is that as a share of the day's sales.`}
              </p>
            </div>
            <DayTrend data={trend} label="What was short each day, with its share of the day's sales as a line." />
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><i aria-hidden className="inline-block size-2.5 rounded-[3px] bg-primary/85" /> Short, in ringgit</span>
              <span className="flex items-center gap-1.5"><i aria-hidden className="inline-block h-0.5 w-4 rounded bg-foreground" /> Share of sales</span>
            </p>
          </div>
          <div className="flex min-w-0 flex-col gap-3 p-6 lg:col-span-5">
            <div>
              <h2 className="text-base font-semibold">Can the numbers be trusted?</h2>
              <p className="text-xs text-muted-foreground">
                <b className="font-semibold text-foreground tabular-nums">{trust.pct}%</b> of outlet days have the stock count, the GRN and the POS deduction. A day with no count gives no variance. A day with no GRN or deduction gives a less reliable one.
              </p>
            </div>
            {trust.rows.length ? (
              <ul className="flex flex-col gap-2">
                {trust.rows.map((t) => (
                  <li key={t.name} className="flex items-start justify-between gap-3 text-sm">
                    <span className="min-w-0">
                      <span className="block font-medium">{t.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {[t.noCount ? `no count ${t.noCount}` : "", t.noGrn ? `no GRN ${t.noGrn}` : "", t.noDed ? `no POS deduction ${t.noDed}` : ""].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="shrink-0 text-right tabular-nums">
                      <b className="font-semibold">{t.complete} of {t.days}</b>
                      <span className="block text-xs text-muted-foreground">days complete</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-sm text-muted-foreground">Every outlet day has all three checks.</p>
            )}
            <p className="text-xs text-muted-foreground">{trust.gaps} of {trust.n} outlets have at least one gap. Showing the 6 with the most.</p>
          </div>
        </section>
      </Card>

      <Card className="gap-0 p-0 shadow-sm">
        <div className="px-4 pt-4">
          <h2 className="text-base font-semibold">Where it is short</h2>
          <p className="text-xs text-muted-foreground">One row for each outlet and item. Click an item or an outlet to look at it in the charts above.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 px-4 pt-3 pb-3">
          <FilterSearch value={tq} onChange={setTq} placeholder="Search this table" />
          <FilterSelect boxed label="Pattern" value={tpat} onChange={setTpat} options={T_PAT} />
          <FilterSelect boxed label="Size" value={tsize} onChange={setTsize} options={T_SIZE} />
        </div>
        {tNarrowed ? (
          <div className="flex flex-wrap items-center gap-2 border-t px-4 py-3">
            {tq ? <Chip label={`Search: “${tq}”`} onClear={() => setTq("")} /> : null}
            {tpat !== "all" ? <Chip label={`Pattern: ${T_PAT.find((o) => o.value === tpat)!.label}`} onClear={() => setTpat("all")} /> : null}
            {tsize !== "all" ? <Chip label={`Size: a day ${rm(CRIT_RM)} or more short`} onClear={() => setTsize("all")} /> : null}
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={clearTable}>Clear all</Button>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t px-4 py-3">
          <p aria-live="polite" className="text-sm">
            <b className="text-base font-semibold tabular-nums">{tableRows.length} {tableRows.length === 1 ? "pair" : "pairs"}</b>
            <span className="text-muted-foreground tabular-nums"> · net {signed(sum(tableRows, (c) => c.net))}</span>
            {tq ? <span className="text-muted-foreground"> · in this table matching “{tq.trim()}”</span> : null}
          </p>
          {tNarrowed ? <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={clearTable}>Clear filters</Button> : null}
        </div>
        <div className="overflow-x-auto px-2 pb-2">
          <Table className="min-w-[820px]">
            <TableHeader>
              <TableRow>
                <SortHead label="Item" sortKey="item" sort={tv.sort} onSort={tv.toggleSort} className="text-left" />
                <SortHead label="Outlet" sortKey="outlet" sort={tv.sort} onSort={tv.toggleSort} className="text-left" />
                <SortHead label="Days short" sortKey="days" sort={tv.sort} onSort={tv.toggleSort} className="text-right" />
                <SortHead label="Net variance" sortKey="net" sort={tv.sort} onSort={tv.toggleSort} className="text-right" />
                <SortHead label="Last count" sortKey="last" sort={tv.sort} onSort={tv.toggleSort} className="text-right" />
                <SortHead label="Pattern" sortKey="pattern" sort={tv.sort} onSort={tv.toggleSort} className="text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tv.rows.map((c) => (
                <TableRow key={`${c.o}-${c.i}`}>
                  <TableCell className="pl-3">
                    <button type="button" onClick={() => setSelI(c.i)} aria-label={`Look at ${ITEMS[c.i].name}`} className={cn("rounded text-left font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring", selI === c.i && "text-primary")}>
                      {ITEMS[c.i].name}
                    </button>
                    <span className="block text-xs text-muted-foreground">{ITEMS[c.i].code} · {cap(ITEMS[c.i].cat)}</span>
                  </TableCell>
                  <TableCell>
                    <button type="button" onClick={() => setSelO(c.o)} aria-label={`Look at ${outletName(c.o)}`} className={cn("rounded text-left outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring", selO === c.o && "font-medium text-primary")}>
                      {outletName(c.o)}
                    </button>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{c.daysShort} of {c.days}</TableCell>
                  <TableCell className={cn("text-right font-semibold tabular-nums", signTone(c.net))}>{signed(c.net)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {c.last ? (
                      <>
                        {c.last.phys} {ITEMS[c.i].uom}
                        <span className="block text-xs text-muted-foreground">expected {c.last.sys}</span>
                      </>
                    ) : (
                      "–"
                    )}
                  </TableCell>
                  <TableCell className="pr-3 text-right"><PatternMark p={c.pattern} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!tableRows.length ? (
            <div className="px-4 py-12 text-center">
              <p className="font-semibold">No pairs match these filters</p>
              <Button variant="outline" className="mt-4" onClick={tNarrowed ? clearTable : reset}>Clear filters</Button>
            </div>
          ) : null}
        </div>
        <TablePagination view={tv} noun="pairs" note={`Short is a day ${rm(SHORT_RM)} or more under what the system expects. Repeated is short on at least 3 days and at least 40% of the days counted.`} />
      </Card>

      <Card className="gap-1 p-6 shadow-sm">
        <h2 className="text-base font-semibold">Why it happened</h2>
        <p className="text-sm text-muted-foreground">
          Planned. The reason for a shortage (wastage, a transfer, a counting mistake, a loss) and who is looking into it are not recorded yet. They need to be saved with the count, so they come with the real data.
        </p>
      </Card>
    </>
  );
}
