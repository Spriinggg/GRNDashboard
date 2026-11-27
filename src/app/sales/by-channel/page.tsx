"use client";

import { ArrowLeft } from "lucide-react";
import { useMemo, useState } from "react";
import { ChannelDonut, ChannelLogo } from "@/components/channel-parts";
import { OutletChannelDrill } from "@/components/outlet-channel-drill";
import { fmtDelta, fmtFull } from "@/components/drill-chart";
import { FeeExplorer } from "@/components/fee-breakdown";
import { FilterSelect } from "@/components/filter-select";
import { Kpis } from "@/components/kpi-strip";
import { PageHeader } from "@/components/page-header";
import { ChannelStack } from "@/components/sales-charts";
import { Chip, Chips, FilterBar, FilterSearch } from "@/components/sales-ui";
import { SortHead, TablePagination } from "@/components/table-parts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { useTableView } from "@/hooks/use-table-view";
import { CHANNELS, CHANNEL_KEYS, channelDays, channelTrend, channelView } from "@/lib/channel-mock";
import type { ChannelKey } from "@/lib/channel-mock";
import { LAST_M, MONTHS, PERIODS, REGION_LABEL, YEAR, periodOf } from "@/lib/overview-mock";
import type { Metric, PeriodKey } from "@/lib/overview-mock";
import type { Region } from "@/lib/outlet-locations";
import { cn } from "@/lib/utils";

type Measure = "sales" | "orders";
// How much of an outlet's sales comes from the delivery platforms.
const T_DEL = [
  { value: "all", label: "Any" },
  { value: "high", label: "50% or more" },
  { value: "mid", label: "30% to 50%" },
  { value: "low", label: "Under 30%" },
];

export default function SalesByChannel() {
  const [measure, setMeasure] = useState<Measure>("sales");
  const [period, setPeriod] = useState<PeriodKey>("mtd");
  const [region, setRegion] = useState<"all" | Region>("all");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<ChannelKey[]>(CHANNEL_KEYS);
  const [focus, setFocus] = useState<ChannelKey | null>(null);

  const metric: Metric = measure === "sales" ? "sales" : "pizzas";
  const what = measure === "sales" ? "Net sales" : "Orders";
  const pd = periodOf(period);
  const view = useMemo(() => channelView(region, period, metric, q), [region, period, metric, q]);
  const names = useMemo(() => view.rows.map((r) => r.name), [view]);
  const trend = useMemo(() => channelTrend(names, metric), [names, metric]);
  // The mix chart shows each month of the year, or one month day by day. Click a month or choose one to open it.
  const [mixMonth, setMixMonth] = useState<number | null>(null);
  const mixData = useMemo(() => (mixMonth === null ? trend : channelDays(names, mixMonth, metric)), [mixMonth, trend, names, metric]);

  const reset = () => {
    setPeriod("mtd");
    setRegion("all");
    setQ("");
    setSel(CHANNEL_KEYS);
    setFocus(null);
    tv.setSort(null);
  };

  // If a channel is switched off, the focus on it goes too.
  const onChannels = (v: ChannelKey[]) => {
    setSel(v);
    if (focus && !v.includes(focus)) setFocus(null);
  };
  const pickChannel = (k: ChannelKey) => {
    const next = focus === k ? null : k;
    setFocus(next);
    if (next) tv.setSort({ key: next, dir: "desc" });
  };

  const selCh = CHANNELS.filter((c) => sel.includes(c.key));
  const rowTotal = (vals: Record<ChannelKey, number>) => selCh.reduce((s, c) => s + vals[c.key], 0);
  const total = selCh.reduce((s, c) => s + view.totals[c.key], 0);
  const prev = view.prevTotals ? selCh.reduce((s, c) => s + view.prevTotals![c.key], 0) : 0;
  const platforms = selCh.filter((c) => c.platform);
  const deliv = platforms.reduce((s, c) => s + view.totals[c.key], 0);
  const sorted = [...selCh].sort((a, b) => view.totals[b.key] - view.totals[a.key]);
  const topCh = sorted[0];
  const pct = (v: number) => (total ? Math.round((v / total) * 100) : 0);

  // Channels that carry fees: the delivery platforms and the payment gateway of the app.
  const fees = view.fees.filter((f) => sel.includes(f.key) && f.sales > 0);
  const feeRM = fees.reduce((s, f) => s + f.commission + f.ads + f.service + f.gateway + f.adjust, 0);
  const feeSales = fees.reduce((s, f) => s + f.sales, 0);

  // Largest outlet first until a person sorts by a column. Ten outlets a page.
  const ranked = useMemo(() => [...view.rows].sort((a, b) => rowTotal(b.vals) - rowTotal(a.vals)), [view, sel]); // eslint-disable-line react-hooks/exhaustive-deps
  // The table has its own search and filters, on top of the ones at the head of the page. They narrow the table only.
  const [tq, setTq] = useState("");
  const [tled, setTled] = useState<string>("all");
  const [tdel, setTdel] = useState<string>("all");
  const tNarrowed = !!tq || tled !== "all" || tdel !== "all";
  const clearTable = () => {
    setTq("");
    setTled("all");
    setTdel("all");
  };
  const delivShare = (vals: Record<ChannelKey, number>) => {
    const t = rowTotal(vals);
    return t ? platforms.reduce((s, c) => s + vals[c.key], 0) / t : 0;
  };
  const tableRows = useMemo(() => {
    if (!tNarrowed) return ranked;
    const needle = tq.trim().toLowerCase();
    return ranked.filter((r) => {
      if (needle && !(r.name + " " + r.area).toLowerCase().includes(needle)) return false;
      if (tled !== "all") {
        const lead = [...selCh].sort((a, b) => r.vals[b.key] - r.vals[a.key])[0];
        if (!lead || lead.key !== tled) return false;
      }
      if (tdel !== "all") {
        const d = delivShare(r.vals);
        if (tdel === "high" ? d < 0.5 : tdel === "mid" ? d < 0.3 || d >= 0.5 : d >= 0.3) return false;
      }
      return true;
    });
  }, [ranked, tNarrowed, tq, tled, tdel, selCh, platforms]); // eslint-disable-line react-hooks/exhaustive-deps
  const tableTotals = Object.fromEntries(CHANNEL_KEYS.map((k) => [k, tableRows.reduce((s, r) => s + r.vals[k], 0)])) as Record<ChannelKey, number>;
  const tableTotal = selCh.reduce((s, c) => s + tableTotals[c.key], 0);
  const tv = useTableView(tableRows, {
    pageSize: 10,
    resetKey: `${region}|${period}|${q}|${sel.join(",")}|${measure}|${tq}|${tled}|${tdel}`,
    sorts: {
      name: (r) => r.name,
      total: (r) => rowTotal(r.vals),
      ...Object.fromEntries(CHANNEL_KEYS.map((k) => [k, (r: (typeof view.rows)[number]) => r.vals[k]])),
    },
  });
  const colMax = Object.fromEntries(CHANNEL_KEYS.map((k) => [k, Math.max(1, ...view.rows.map((r) => r.vals[k]))])) as Record<ChannelKey, number>;

  const vsText = view.prevTotals && prev > 0 && !q ? ` · ${fmtDelta(total / prev - 1)} vs ${pd.prevLabel}` : "";

  return (
    <>
      <PageHeader
        title="Sales by channel"
        subtitle={
          <>
            Where the sales came from: the POS, the US Pizza app and the delivery platforms.{" "}
            <span className="ml-1 rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-foreground">Sample data</span>
          </>
        }
      />

      <FilterBar
        extra={
          <Chips<ChannelKey>
            label="Channels"
            value={sel}
            onChange={onChannels}
            options={CHANNELS.map((c) => ({
              value: c.key,
              label: c.label,
              color: c.color,
              // The logo says the name. The US Pizza emblem carries the word App itself (see ChannelLogo).
              node: <ChannelLogo channel={c} size="chip" />,
              labelHidden: true,
            }))}
          />
        }
        active={[
          ...(period !== "mtd" ? [{ key: "period", label: `Period: ${pd.label}`, onClear: () => setPeriod("mtd") }] : []),
          ...(region !== "all" ? [{ key: "region", label: `Region: ${REGION_LABEL[region]}`, onClear: () => setRegion("all") }] : []),
          ...(q ? [{ key: "q", label: `Outlet: “${q}”`, onClear: () => setQ("") }] : []),
          ...(sel.length < CHANNEL_KEYS.length
            ? [
                {
                  key: "ch",
                  label: `Channels: ${selCh.map((c) => c.label).join(", ")}`,
                  node: (
                    <>
                      Channels
                      {selCh.map((c) => (
                        <ChannelLogo key={c.key} channel={c} size="chip" />
                      ))}
                    </>
                  ),
                  onClear: () => setSel(CHANNEL_KEYS),
                },
              ]
            : []),
          ...(focus
            ? [
                {
                  key: "focus",
                  label: `Focus: ${CHANNELS.find((c) => c.key === focus)!.label}`,
                  node: (
                    <>
                      Focus
                      <ChannelLogo channel={CHANNELS.find((c) => c.key === focus)!} size="chip" />
                    </>
                  ),
                  onClear: () => setFocus(null),
                },
              ]
            : []),
        ]}
        onClearAll={reset}
        summary={`${view.rows.length} outlets · ${selCh.length} of ${CHANNELS.length} channels · ${pd.label}`}
      >
        <FilterSearch value={q} onChange={setQ} placeholder="Search outlets" />
        <FilterSelect boxed label="Period" value={period} onChange={setPeriod} options={PERIODS.map((p) => ({ value: p.key, label: p.label }))} />
        <FilterSelect boxed label="Region" value={region} onChange={(v) => setRegion(v as "all" | Region)} options={[{ value: "all", label: "All regions" }, ...(Object.keys(REGION_LABEL) as Region[]).map((r) => ({ value: r, label: REGION_LABEL[r] }))]} />
        <FilterSelect boxed label="Measure" value={measure} onChange={setMeasure} options={[{ value: "sales", label: "Sales (RM)" }, { value: "orders", label: "Orders" }]} />
      </FilterBar>

      <section aria-label="Summary">
        <Kpis
          label={`${what} summary`}
          columns={4}
          stacked
          kpis={[
            { key: "total", count: fmtFull(metric, total), label: `${what.toLowerCase()}${vsText}`, note: `${what}, ${region === "all" ? "all outlets" : REGION_LABEL[region]}, ${pd.label}. ${view.rows.length} outlets.` },
            { key: "deliv", count: platforms.length && total ? `${pct(deliv)}%` : "–", label: "from delivery platforms", note: platforms.length ? `${platforms.map((c) => c.short).join(", ")}: ${fmtFull(metric, deliv)}.` : "No delivery platform is selected." },
            { key: "top", count: topCh ? topCh.label : "–", visual: topCh ? <><ChannelLogo channel={topCh} size="kpi" showName={false} /><span className="text-lg leading-none font-semibold">{topCh.label}</span></> : undefined, label: topCh ? `biggest channel · ${pct(view.totals[topCh.key])}%` : "biggest channel", note: topCh ? `${topCh.label}: ${fmtFull(metric, view.totals[topCh.key])}.` : "No channel is selected." },
            { key: "fees", count: feeSales ? fmtFull("sales", feeRM) : "–", label: feeSales ? `fees and charges · ${((feeRM / feeSales) * 100).toFixed(1)}% of their sales` : "fees and charges", note: "Commission, advertising, service fees, payment gateway and adjustments on the selected channels." },
          ]}
        />
      </section>

      <Card className="gap-0 p-0 shadow-sm">
        <section aria-label="Channels" className="grid lg:grid-cols-12">
          <div className="flex min-w-0 flex-col gap-3 border-b p-6 lg:col-span-6 lg:border-r lg:border-b-0">
            <div>
              <h2 className="text-base font-semibold">{what} by channel</h2>
              <p className="text-xs text-muted-foreground">{pd.label}. Point at a slice for the figures. Click it to focus that channel everywhere on this page.</p>
            </div>
            {sorted.length ? <ChannelDonut rows={sorted.map((c) => ({ k: c.key, channel: c, value: view.totals[c.key], prev: view.prevTotals && !q ? view.prevTotals[c.key] : null }))} total={total} metric={metric} measureLabel={what} focus={focus} onPick={pickChannel} /> : <p className="py-10 text-center text-sm text-muted-foreground">Select a channel to see it here.</p>}
          </div>
          <div className="flex min-w-0 flex-col gap-3 p-6 lg:col-span-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base font-semibold">{mixMonth === null ? "Channel mix through the year" : `Channel mix, ${MONTHS[mixMonth]} ${YEAR}, day by day`}</h2>
                <p className="text-xs text-muted-foreground">
                  {mixMonth === null ? `Average ${measure === "sales" ? "sales" : "orders"} per day in each month, January to ${MONTHS[LAST_M]}. Click a month to see its days, or choose one.` : `${measure === "sales" ? "Sales" : "Orders"} on each day of the month, all channels. Weekends are the taller bars.`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {mixMonth !== null ? (
                  <Button variant="outline" size="sm" onClick={() => setMixMonth(null)}>
                    <ArrowLeft aria-hidden /> Year
                  </Button>
                ) : null}
                <FilterSelect boxed label="View" value={mixMonth === null ? "year" : String(mixMonth)} onChange={(v) => setMixMonth(v === "year" ? null : +v)} options={[{ value: "year", label: "Each month" }, ...MONTHS.slice(0, LAST_M + 1).map((m, i) => ({ value: String(i), label: `${m} by day` }))]} />
              </div>
            </div>
            <ChannelStack
              data={mixData}
              keys={selCh.map((c) => c.key)}
              focus={focus}
              metric={metric}
              unit={mixMonth === null ? "per day, average" : "total for the day"}
              label={mixMonth === null ? `Average daily ${what.toLowerCase()} by month and channel.` : `${what} by day in ${MONTHS[mixMonth]}, by channel.`}
              onPick={mixMonth === null ? (id) => setMixMonth(+id) : undefined}
            />
            <p className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
              {selCh.map((c) => (
                <span key={c.key} className="flex items-center gap-1.5">
                  <i aria-hidden className="inline-block size-2.5 rounded-[3px]" style={{ background: c.color }} />
                  <ChannelLogo channel={c} size="chip" />
                </span>
              ))}
            </p>
          </div>
        </section>
      </Card>

      <Card className="gap-0 p-0 shadow-sm">
        {fees.length ? (
          <FeeExplorer fees={fees} />
        ) : (
          <div className="p-6">
            <h2 className="text-base font-semibold">What the platforms take</h2>
            <p className="py-6 text-center text-sm text-muted-foreground">Select GrabFood, ShopeeFood, FoodPanda or the US Pizza app to see their fees.</p>
          </div>
        )}
      </Card>

      <Card className="gap-0 p-0 shadow-sm">
        <OutletChannelDrill rows={view.rows} channels={selCh} metric={metric} measureLabel={what} periodLabel={pd.label} />
      </Card>

      <Card className="gap-0 p-0 shadow-sm">
        <div className="px-4 pt-4">
          <h2 className="text-base font-semibold">Outlet by channel</h2>
          <p className="text-xs text-muted-foreground">Ten outlets a page. A darker cell is a bigger figure compared with the other outlets in that channel.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 px-4 pt-3 pb-3">
          <FilterSearch value={tq} onChange={setTq} placeholder="Search this table" />
          <FilterSelect boxed label="Led by" value={tled} onChange={setTled} options={[{ value: "all", label: "Any channel" }, ...selCh.map((c) => ({ value: c.key as string, label: c.label }))]} />
          <FilterSelect boxed label="Delivery share" value={tdel} onChange={setTdel} options={T_DEL} />
        </div>
        {tNarrowed ? (
          <div className="flex flex-wrap items-center gap-2 border-t px-4 py-3">
            {tq ? <Chip label={`Search: “${tq}”`} onClear={() => setTq("")} /> : null}
            {tled !== "all" ? <Chip label={`Led by: ${CHANNELS.find((c) => c.key === tled)?.label ?? tled}`} node={<>Led by<ChannelLogo channel={CHANNELS.find((c) => c.key === tled)!} size="chip" /></>} onClear={() => setTled("all")} /> : null}
            {tdel !== "all" ? <Chip label={`Delivery share: ${T_DEL.find((o) => o.value === tdel)!.label}`} onClear={() => setTdel("all")} /> : null}
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={clearTable}>
              Clear all
            </Button>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t px-4 py-3">
          <p aria-live="polite" className="text-sm">
            <b className="text-base font-semibold tabular-nums">
              {tableRows.length} {tableRows.length === 1 ? "outlet" : "outlets"}
            </b>
            <span className="text-muted-foreground tabular-nums"> · {fmtFull(metric, tableTotal)}</span>
            {q ? <span className="text-muted-foreground"> · matching “{q.trim()}”</span> : null}
            {tq ? <span className="text-muted-foreground"> · in this table matching “{tq.trim()}”</span> : null}
          </p>
          {tNarrowed ? (
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={clearTable}>
              Clear filters
            </Button>
          ) : null}
        </div>
        <div className="overflow-x-auto px-2 pb-2">
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow>
                <SortHead label="Outlet" sortKey="name" sort={tv.sort} onSort={tv.toggleSort} className="text-left" />
                {selCh.map((c) => (
                  <SortHead key={c.key} label={c.label} node={<ChannelLogo channel={c} size="chip" />} sortKey={c.key} sort={tv.sort} onSort={tv.toggleSort} className={cn("text-right", focus === c.key && "text-primary")} />
                ))}
                <SortHead label="Total" sortKey="total" sort={tv.sort} onSort={tv.toggleSort} className="text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="bg-muted/50 font-semibold hover:bg-muted/50">
                <TableCell className="pl-3">All {tableRows.length} outlets</TableCell>
                {selCh.map((c) => (
                  <TableCell key={c.key} className="text-right tabular-nums">{fmtFull(metric, tableTotals[c.key])}</TableCell>
                ))}
                <TableCell className="text-right tabular-nums">{fmtFull(metric, tableTotal)}</TableCell>
              </TableRow>
              {tv.rows.map((r) => (
                <TableRow key={r.name}>
                  <TableCell className="pl-3">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-muted-foreground">{r.area}</div>
                  </TableCell>
                  {selCh.map((c) => (
                    <TableCell key={c.key} className={cn("text-right tabular-nums", focus === c.key && "font-semibold")} style={{ background: `color-mix(in oklab, var(--primary) ${Math.round((r.vals[c.key] / colMax[c.key]) * 12)}%, transparent)` }}>
                      {fmtFull(metric, r.vals[c.key])}
                    </TableCell>
                  ))}
                  <TableCell className="text-right font-semibold tabular-nums">{fmtFull(metric, rowTotal(r.vals))}</TableCell>
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
        <TablePagination view={tv} noun="outlets" />
      </Card>
    </>
  );
}
