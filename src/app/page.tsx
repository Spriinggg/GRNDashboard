"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChannelLogo } from "@/components/channel-parts";
import { OverviewCard, PresetGroup, Segmented } from "@/components/dashboard-parts";
import type { Change, Preset } from "@/components/dashboard-parts";
import { HBars, Ring, SalesArea, TargetLine, Waterfall, compact } from "@/components/dashboard-charts";
import { DateRangeFilter } from "@/components/date-range-filter";
import { useData } from "@/components/data-provider";
import { fmtDelta } from "@/components/drill-chart";
import { FilterSelect } from "@/components/filter-select";
import { OutletMap } from "@/components/outlet-map";
import { PageHeader } from "@/components/page-header";
import { FilterBar, FilterSearch } from "@/components/sales-ui";
import { RM, signTone } from "@/lib/calc";
import { dayRows } from "@/lib/checks";
import { CHANNELS } from "@/lib/channel-mock";
import { MTD_SPAN, SAMPLE_MAX, SAMPLE_MIN, buildOverview, outletMetrics, previousSpan, spanDays } from "@/lib/dashboard-data";
import { isOpen, spanText, toIso } from "@/lib/date-span";
import type { DateSpan } from "@/lib/date-span";
import { TARGET as LABOUR_TARGET } from "@/lib/labour-mock";
import { OUTLETS, REGION_LABEL } from "@/lib/overview-mock";
import { outletLocations } from "@/lib/outlet-locations";
import type { Region } from "@/lib/outlet-locations";
import type { MapPin } from "@/lib/outlet-pins";
import { outletRows } from "@/lib/outlets";
import { TARGET as TREAMS_TARGET } from "@/lib/treeams-mock";

const MTD = MTD_SPAN;
const PRESETS: Preset[] = [
  { key: "d7", label: "Last 7 days", span: { from: toIso(new Date(2026, SAMPLE_MAX.getMonth(), SAMPLE_MAX.getDate() - 6)), to: toIso(SAMPLE_MAX) } },
  { key: "mtd", label: "Month to date", span: MTD },
  { key: "oct", label: "October", span: { from: "2026-10-01", to: "2026-10-31" } },
];
const rmShort = (v: number) => RM(Math.round(v));
const pts = (v: number) => `${Math.abs(v).toFixed(1)} points`;
const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
};
// A change smaller than a tenth of a point or percent is "no change", so a flat figure is not painted red or green.
const flat = (n: number, unit: number) => Math.abs(n * unit) < 0.05;

type MapMetric = "sales" | "short" | "labour" | "checklists";
const METRICS: { key: MapMetric; label: string }[] = [
  { key: "sales", label: "Net sales" },
  { key: "short", label: "Food short" },
  { key: "labour", label: "Labour" },
  { key: "checklists", label: "Checklists" },
];
const METRIC_LEGEND: Record<MapMetric, { figure: string; hot: string }> = {
  sales: { figure: "Figure: net sales for the dates", hot: "" },
  short: { figure: "Figure: food short for the dates", hot: "Short more than the network average" },
  labour: { figure: "Figure: labour as a share of net sales", hot: `Over the ${LABOUR_TARGET}% target` },
  checklists: { figure: "Figure: checklist tasks done", hot: `Under the ${TREAMS_TARGET}% target` },
};

export default function Dashboard() {
  const { store, grnDocs, daysByOutlet, ensureRange } = useData();
  const router = useRouter();
  const go = (href: string) => () => router.push(href);
  const [span, setSpan] = useState<DateSpan>(MTD);
  const [region, setRegion] = useState<"all" | Region>("all");
  const [q, setQ] = useState("");
  // An outlet chosen on the map makes every card about that outlet.
  const [picked, setPicked] = useState("");
  const clearPick = useCallback(() => setPicked(""), []);
  const [metric, setMetric] = useState<MapMetric>("sales");
  const needle = q.trim().toLowerCase();
  const prev = previousSpan(span);
  // The real-file cards (Count & GRN, Uploads) read the days in these dates, so make sure they are loaded.
  useEffect(() => {
    void ensureRange(span);
  }, [ensureRange, span]);
  const label = PRESETS.find((p) => p.span.from === span.from && p.span.to === span.to)?.label;

  // The outlets the search and region let through, then the one picked on the map if there is one.
  const base = useMemo(() => OUTLETS.map((_, o) => o).filter((o) => (region === "all" || OUTLETS[o].region === region) && (!needle || (OUTLETS[o].name + " " + OUTLETS[o].area).toLowerCase().includes(needle))), [region, needle]);
  const pool = useMemo(() => (picked ? OUTLETS.map((_, o) => o).filter((o) => OUTLETS[o].name === picked) : base), [picked, base]);
  const poolNames = useMemo(() => new Set(pool.map((o) => OUTLETS[o].name.toLowerCase())), [pool]);
  const ov = useMemo(() => buildOverview(span, pool), [span, pool]);
  const metrics = useMemo(() => outletMetrics(span), [span]);

  // Real files: Count & GRN, Outlets and Uploads. Outlets use the latest loaded day, the other two the dates chosen.
  const outlets = useMemo(() => outletRows(store, daysByOutlet).filter((r) => poolNames.has(r.name.toLowerCase())), [store, daysByOutlet, poolNames]);
  const okSet = useMemo(() => new Set(outlets.filter((r) => r.on).map((r) => r.ok)), [outlets]);
  const days = useMemo(() => dayRows(store, grnDocs).filter((r) => okSet.has(r.ok) && r.iso >= span.from && r.iso <= span.to), [store, grnDocs, okSet, span]);
  const withData = outlets.filter((r) => r.on);
  const crit = withData.filter((r) => r.status === "crit").length;
  const warn = withData.filter((r) => r.status === "warn").length;
  const good = withData.filter((r) => r.status === "good").length;
  const complete = days.filter((r) => r.complete).length;
  const nCount = days.filter((r) => r.counted).length;
  const nGrn = days.filter((r) => r.grn).length;
  const nDed = days.filter((r) => r.ded).length;
  const last = Object.values(store)
    .filter((d) => okSet.has(d.ok) && d.upAt)
    .sort((a, b) => (b.upAt ?? "").localeCompare(a.upAt ?? ""))[0];

  // The map shows all 44 outlets for the figure chosen. An outlet the filters leave out is drawn as a small grey logo.
  const baseSet = useMemo(() => new Set(base), [base]);
  const avgShort = useMemo(() => {
    const open = metrics.filter((m) => m.open);
    return open.length ? open.reduce((s, m) => s + m.shortPct, 0) / open.length : 0;
  }, [metrics]);
  const pins: MapPin[] = useMemo(
    () =>
      outletLocations.map((l, i) => {
        const m = metrics[i];
        const out = !m.open || !baseSet.has(i);
        const v = metric === "sales" ? `RM ${compact(m.sales)}` : metric === "short" ? `−RM ${compact(m.short)}` : metric === "labour" ? `${m.labour.toFixed(0)}%` : `${m.treeams.toFixed(0)}%`;
        const hot = !out && (metric === "short" ? m.shortPct > avgShort * 1.25 : metric === "labour" ? m.labour > LABOUR_TARGET : metric === "checklists" ? m.treeams < TREAMS_TARGET : false);
        return { name: l.name, lat: l.lat, lng: l.lng, region: l.region, value: v, hot, empty: out, title: out ? `${l.name}: not in these filters` : `${l.name}: ${v}`, tip: out ? `${l.name} · not in these filters` : `${l.name} · ${v}` };
      }),
    [metrics, metric, baseSet, avgShort],
  );

  const none = pool.length === 0;
  const dayNote = `${ov.days} ${ov.days === 1 ? "day" : "days"}`;
  const vs = ov.hasPrev && prev ? `against ${spanText(prev)}` : "no earlier dates to compare";
  const scope = picked || (region === "all" ? "all outlets" : REGION_LABEL[region]);

  const salesChange: Change | null = ov.sales.delta === null ? null : flat(ov.sales.delta, 100) ? { text: `no change ${vs}`, n: 0 } : { text: `${fmtDelta(ov.sales.delta)} ${vs}`, n: ov.sales.delta };
  const ptsChange = (n: number | null, what: string, good?: boolean): Change | null => (n === null ? null : flat(n, 1) ? { text: `${what ? what + " " : ""}no change on the dates before`, n: 0, good } : { text: `${what ? what + " " : ""}${n >= 0 ? "up" : "down"} ${pts(n)}${what ? "" : " on the dates before"}`, n, good });
  const marginChange = ptsChange(ov.pnl.marginPts, "margin");
  const foodChange: Change | null = ov.food.delta === null ? null : flat(ov.food.delta, 100) ? { text: "no change on the dates before", n: 0, good: false } : { text: `${ov.food.delta >= 0 ? "up" : "down"} ${Math.abs(ov.food.delta * 100).toFixed(1)}% on the dates before`, n: ov.food.delta, good: false };
  const labourChange = ptsChange(ov.labour.ptsVsBefore, "", false);
  const treamsChange = ptsChange(ov.treeams.ptsVsBefore, "");

  const clearAll = () => {
    setSpan(MTD);
    setRegion("all");
    setQ("");
    setPicked("");
  };

  const maxItem = ov.food.items[0]?.short || 1;
  const net = ov.sales.net;

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Every page at a glance for the dates you choose. Point at a chart to read it, click it to open the page." />

      <FilterBar
        active={[
          ...(picked ? [{ key: "picked", label: `Outlet: ${picked}`, onClear: clearPick }] : []),
          ...(region !== "all" ? [{ key: "region", label: `Region: ${REGION_LABEL[region]}`, onClear: () => setRegion("all") }] : []),
          ...(q ? [{ key: "q", label: `Search: “${q}”`, onClear: () => setQ("") }] : []),
          ...(span.from !== MTD.from || span.to !== MTD.to ? [{ key: "dates", label: `Dates: ${spanText(span)}`, onClear: () => setSpan(MTD) }] : []),
        ]}
        onClearAll={clearAll}
        summary={`${picked || `${pool.length} ${pool.length === 1 ? "outlet" : "outlets"}`} · ${spanText(span)} (${dayNote}) · ${vs}`}
        extra={
          <>
            <DateRangeFilter label="Dates" value={span} onChange={(v) => setSpan(isOpen(v) ? MTD : v)} min={SAMPLE_MIN} max={SAMPLE_MAX} />
            <PresetGroup presets={PRESETS} value={span} onPick={setSpan} />
            {!label ? <span className="text-xs text-muted-foreground">Custom dates, {spanDays(span)} days</span> : null}
          </>
        }
      >
        <FilterSearch value={q} onChange={setQ} placeholder="Search outlets" />
        <FilterSelect boxed label="Region" value={region} onChange={(v) => setRegion(v as "all" | Region)} options={[{ value: "all", label: "All regions" }, ...(Object.keys(REGION_LABEL) as Region[]).map((r) => ({ value: r, label: REGION_LABEL[r] }))]} />
      </FilterBar>

      {none ? (
        <div className="rounded-xl bg-card px-4 py-12 text-center shadow-sm ring-1 ring-foreground/10">
          <p className="font-semibold">No outlets match these filters</p>
          <button type="button" onClick={clearAll} className="mt-3 text-sm text-primary underline-offset-2 hover:underline">Clear filters</button>
        </div>
      ) : (
        <>
          <section aria-label="Map and sales" className="grid gap-4 lg:grid-cols-12">
            <div className="flex lg:col-span-7">
              <OutletMap
                title="Outlets on the map"
                pins={pins}
                selected={picked}
                onSelect={(name) => setPicked((p) => (p === name ? "" : name))}
                onClear={clearPick}
                extra={<Segmented label="Figure on the map" options={METRICS} value={metric} onChange={setMetric} />}
                legend={[
                  { label: METRIC_LEGEND[metric].figure, swatch: "figure" },
                  ...(METRIC_LEGEND[metric].hot ? [{ label: METRIC_LEGEND[metric].hot, swatch: "hot" as const }] : []),
                  { label: "Not open or not in the filters", swatch: "empty" },
                  { label: "Chosen outlet", swatch: "selected" },
                ]}
                help="Click an outlet to make every card about it, click it again to show all."
              />
            </div>
            <OverviewCard
              sample
              className="lg:col-span-5"
              title="Sales by outlet"
              href="/sales/by-outlet"
              value={rmShort(net)}
              label={`net sales, ${dayNote}`}
              change={salesChange}
              note={`For ${scope}`}
              visual={<SalesArea data={ov.sales.daily} label={`Net sales each day for ${ov.sales.daily.length} days.`} onOpen={go("/sales/by-outlet")} />}
              rows={ov.sales.top.length > 1 ? ov.sales.top.map((t, i) => ({ key: t.name, label: t.name, figure: rmShort(t.net), share: (t.net / (ov.sales.top[0].net || 1)) * 100, tone: i === 0 ? "primary" : "muted" })) : undefined}
              linkText="Open sales by outlet"
            />
          </section>

          <section aria-label="Every page" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <OverviewCard
              sample
              title="Sales by channel"
              href="/sales/by-channel"
              value={`${ov.channels[0].share.toFixed(0)}%`}
              label={`from ${CHANNELS.find((c) => c.key === ov.channels[0].key)!.short}, the biggest channel`}
              note="Share of net sales by channel"
              visual={
                <Ring
                  unit="net sales"
                  total={`RM ${compact(net)}`}
                  label="Net sales by channel"
                  onOpen={go("/sales/by-channel")}
                  fmt={(v) => `RM ${compact(v)}`}
                  slices={ov.channels.map((c) => {
                    const ch = CHANNELS.find((x) => x.key === c.key)!;
                    return { key: c.key, label: ch.short, value: Math.round(c.net), color: ch.color, node: <ChannelLogo channel={ch} size="chip" /> };
                  })}
                />
              }
              linkText="Open sales by channel"
            />
            <OverviewCard
              sample
              title="Profit & loss"
              href="/pnl"
              value={rmShort(ov.pnl.gross)}
              label={`gross profit, ${ov.pnl.margin.toFixed(1)}% margin`}
              change={marginChange}
              note="Net sales less platform fees and the cost of food. Labour and overheads are not in yet."
              visual={
                <Waterfall
                  label={`Net sales ${rmShort(net)}, less fees ${rmShort(ov.pnl.fees)}, less the cost of food ${rmShort(ov.pnl.food)}, leaves gross profit ${rmShort(ov.pnl.gross)}.`}
                  onOpen={go("/pnl")}
                  rows={[
                    { name: "Net sales", range: [0, net], text: `RM ${compact(net)}`, share: 100, color: "var(--muted-foreground)" },
                    { name: "Fees", range: [net - ov.pnl.fees, net], text: `−${compact(ov.pnl.fees)}`, share: ov.pnl.feesPct, color: "var(--muted-foreground)" },
                    { name: "Food", range: [ov.pnl.gross, net - ov.pnl.fees], text: `−${compact(ov.pnl.food)}`, share: ov.pnl.foodPct, color: "var(--muted-foreground)" },
                    { name: "Gross profit", range: [0, ov.pnl.gross], text: `RM ${compact(ov.pnl.gross)}`, share: ov.pnl.margin, color: "var(--primary)" },
                  ]}
                />
              }
              linkText="Open profit & loss"
            />
            <OverviewCard
              sample
              title="Food variance"
              href="/variance"
              value={<span className={signTone(-ov.food.short)}>{ov.food.short ? `−${rmShort(ov.food.short)}` : rmShort(0)}</span>}
              label={`short, ${ov.food.shortPct.toFixed(1)}% of sales`}
              change={foodChange}
              note={`${ov.food.repeated} ${ov.food.repeated === 1 ? "pair is" : "pairs are"} repeatedly short. The items short most:`}
              visual={
                <HBars
                  label={`The ${ov.food.items.length} items short most, ${ov.food.items.map((i) => `${i.name} ${rmShort(i.short)}`).join(", ")}.`}
                  domain={maxItem * 1.05}
                  hint="Click to open Food variance"
                  onOpen={go("/variance")}
                  rows={ov.food.items.map((t) => ({ key: t.name, label: t.name, value: t.short, text: `−${compact(t.short)}`, color: "var(--danger)", tip: [["Short", `−${rmShort(t.short)}`], ["Of all short", `${ov.food.short ? Math.round((t.short / ov.food.short) * 100) : 0}%`]] }))}
                />
              }
              linkText="Open food variance"
            />
            <OverviewCard
              title="Count & GRN"
              href="/discipline"
              value={days.length ? `${complete} of ${days.length}` : "–"}
              label="days with every check"
              note="Stock count, GRN and POS deductions, from the files uploaded"
              empty={days.length ? undefined : "No uploaded days fall in these dates for these outlets."}
              visual={
                <HBars
                  label={`Checks over ${days.length} loaded days: stock count ${nCount}, GRN ${nGrn}, POS deductions ${nDed}.`}
                  domain={100}
                  hint="Click to open Count & GRN"
                  onOpen={go("/discipline")}
                  rows={[
                    { key: "c", label: "Stock count", value: (nCount / (days.length || 1)) * 100, text: `${nCount} of ${days.length}`, color: nCount === days.length ? "var(--success)" : "var(--warning)" },
                    { key: "g", label: "GRN", value: (nGrn / (days.length || 1)) * 100, text: `${nGrn} of ${days.length}`, color: nGrn === days.length ? "var(--success)" : "var(--warning)" },
                    { key: "d", label: "POS deductions", value: (nDed / (days.length || 1)) * 100, text: `${nDed} of ${days.length}`, color: nDed === days.length ? "var(--success)" : "var(--warning)" },
                  ]}
                />
              }
              linkText="Open count & GRN"
            />
            <OverviewCard
              title="Outlets"
              href="/outlets"
              value={`${withData.length} of ${outlets.length}`}
              label="outlets with data"
              note="Status of each outlet on its latest loaded day"
              visual={
                <Ring
                  unit="outlets"
                  total={String(outlets.length)}
                  label={`Outlet status: ${crit} critical, ${warn} short, ${good} on target, ${outlets.length - withData.length} with no data.`}
                  onOpen={go("/outlets")}
                  slices={[
                    { key: "crit", label: "Critical", value: crit, color: "var(--danger)" },
                    { key: "warn", label: "Short", value: warn, color: "var(--warning)" },
                    { key: "good", label: "On target", value: good, color: "var(--success)" },
                    { key: "none", label: "No data yet", value: outlets.length - withData.length, color: "var(--muted-foreground)" },
                  ]}
                />
              }
              linkText="Open outlets"
            />
            <OverviewCard
              sample
              title="Labour vs sales"
              href="/labor"
              value={`${ov.labour.pct.toFixed(1)}%`}
              label={`of net sales, target under ${LABOUR_TARGET}%`}
              change={labourChange}
              note={`${ov.labour.over} of ${ov.labour.of} ${ov.labour.of === 1 ? "outlet is" : "outlets are"} over the target. Overtime is ${ov.labour.ot.toFixed(1)}% of hours.`}
              visual={<TargetLine data={ov.labour.daily} target={LABOUR_TARGET} name="Labour share" label={`Labour as a share of net sales each day against the ${LABOUR_TARGET} percent target.`} onOpen={go("/labor")} />}
              linkText="Open labour vs sales"
            />
            <OverviewCard
              sample
              title="Treeams checklists"
              href="/treeams"
              value={`${ov.treeams.pct.toFixed(1)}%`}
              label={`of tasks done, target ${TREAMS_TARGET}%`}
              change={treamsChange}
              note={`${ov.treeams.under} of ${ov.treeams.of} ${ov.treeams.of === 1 ? "outlet is" : "outlets are"} under the target`}
              visual={
                <HBars
                  label={`Tasks done for each checklist against the ${TREAMS_TARGET} percent target.`}
                  domain={100}
                  target={{ value: TREAMS_TARGET, text: `Target ${TREAMS_TARGET}%` }}
                  hint="Click to open Treeams"
                  onOpen={go("/treeams")}
                  rows={ov.treeams.byType.map((t) => ({ key: t.type, label: t.label, value: t.pct, text: `${t.pct.toFixed(0)}%`, color: t.pct < TREAMS_TARGET ? "var(--primary)" : undefined, tip: [["Tasks done", `${t.pct.toFixed(1)}%`], ["Target", `${TREAMS_TARGET}%`]] }))}
                />
              }
              linkText="Open treeams"
            />
            <OverviewCard
              title="Upload data"
              href="/upload"
              value={String(days.length)}
              label={days.length === 1 ? "day loaded in these dates" : "days loaded in these dates"}
              note={last?.upAt ? `Last upload ${when(last.upAt)}${last.upBy ? ` by ${last.upBy}` : ""}` : "Nothing uploaded in these dates yet"}
              rows={[
                { key: "o", label: "Outlets with files", figure: `${okSet.size} of ${outlets.length}`, share: outlets.length ? (okSet.size / outlets.length) * 100 : 0, tone: "muted" },
                { key: "c", label: "Days with every check", figure: `${complete} of ${days.length}`, share: days.length ? (complete / days.length) * 100 : 0, tone: complete === days.length ? "success" : "warning" },
              ]}
              linkText="Go to upload"
            />
          </section>
          <p className="text-xs text-muted-foreground">Cards marked Sample data use generated figures until their reports are loaded. Count &amp; GRN, Outlets and Upload data use the real files.</p>
        </>
      )}
    </>
  );
}
