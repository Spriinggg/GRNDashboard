"use client";

import { AlertTriangle, ChevronRight, CircleAlert, CircleCheck, ClipboardCheck, MapPin, Percent, Upload } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { useData } from "@/components/data-provider";
import { FoodCostBars, Sparkline, StatusDonut, TrendChart, VarianceBars } from "@/components/charts";
import { ItemStatus } from "@/components/item-status";
import { OutletMap } from "@/components/outlet-map";
import { PageHeader } from "@/components/page-header";
import { StatusIndicator } from "@/components/status-indicator";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RANK, RM, RM2, cap, datesFor, fmtD, fmtS, money, statusOf, totVar, weekToDate } from "@/lib/calc";
import { dayRows } from "@/lib/checks";
import { outletRows } from "@/lib/outlets";
import type { MapPin as Pin } from "@/lib/outlet-pins";
import { cn } from "@/lib/utils";

function Empty({ onSample }: { onSample: () => void }) {
  return (
    <Card className="gap-0 p-0 shadow-sm">
      <div className="px-4 py-12 text-center">
        <p className="font-semibold">No data loaded</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Upload the daily Sales, Stock Count and Stock Movement Excel files to begin.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button nativeButton={false} render={<Link href="/upload" />}>Go to Upload</Button>
          <Button variant="outline" onClick={onSample}>
            Load sample day
          </Button>
        </div>
      </div>
    </Card>
  );
}

type Tone = "danger" | "warning" | "success";
const bar: Record<Tone, string> = { danger: "bg-danger", warning: "bg-warning", success: "bg-success" };

// One card, one headline figure and three rows. Each row is a link to the page behind it.
function ProcessCard({ title, href, value, label, note, rows }: { title: string; href: string; value: string; label: string; note: string; rows: { label: string; tone: Tone; figure: string; share: number }[] }) {
  return (
    <Card className="gap-4 p-5 shadow-sm">
      <h2 className="text-base font-semibold">
        <Link href={href} className="inline-flex items-center gap-1 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
          {title}
          <ChevronRight aria-hidden className="size-4 text-muted-foreground" />
        </Link>
      </h2>
      <div>
        <p className="flex items-baseline gap-2 tabular-nums">
          <span className="text-2xl leading-tight font-semibold">{value}</span>
          <span className="text-sm text-muted-foreground">{label}</span>
        </p>
        <p className="text-xs text-muted-foreground">{note}</p>
      </div>
      <div className="flex flex-1 flex-col justify-between gap-3">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="flex items-center justify-between gap-3 text-sm tabular-nums">
              <span className="flex items-center gap-2">
                <i aria-hidden className={cn("size-2 rounded-full", bar[r.tone])} />
                {r.label}
              </span>
              <span className="font-medium">{r.figure}</span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
              <i className={cn("block h-full rounded-full", bar[r.tone])} style={{ width: `${Math.max(Math.min(r.share, 100), r.share ? 3 : 0)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

type Attn = { key: string; icon: LucideIcon; tone: "danger" | "warning" | "info"; title: React.ReactNode; detail: string; href?: string; onPick?: () => void };

// The things to look at first, most serious first. Each one opens the place where it can be dealt with.
function AttentionRow({ a }: { a: Attn }) {
  const Icon = a.icon;
  const inner = (
    <>
      <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", a.tone === "danger" ? "text-danger" : a.tone === "warning" ? "text-warning" : "text-primary")} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{a.title}</span>
        <span className="block text-xs text-muted-foreground">{a.detail}</span>
      </span>
      <ChevronRight aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
    </>
  );
  const cls = "-mx-2 flex w-[calc(100%+1rem)] items-start gap-3 rounded-lg px-2 py-2 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring";
  return a.href ? (
    <Link href={a.href} className={cls}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={a.onPick} className={cls}>
      {inner}
    </button>
  );
}

export default function Dashboard() {
  const { cur: d, store, grnDocs, loadSample, setOpenCode, setOutlet } = useData();
  const outlets = useMemo(() => outletRows(store), [store]);
  const days = useMemo(() => dayRows(store, grnDocs), [store, grnDocs]);

  if (!d || !d.items) {
    return (
      <>
        <PageHeader title="Dashboard" subtitle="Where the day's food cost drifted from recipe." />
        <Empty onSample={loadSample} />
      </>
    );
  }

  const items = d.items;
  const tot = totVar(d);
  const food = items.filter((x) => x.cat === "FOOD").reduce((s, x) => s + x.varrm, 0);
  const atRisk = items.filter((x) => x.varrm < 0).reduce((s, x) => s + x.varrm, 0);
  const c = { crit: 0, warn: 0, good: 0, info: 0 };
  items.forEach((i) => c[statusOf(i)[0]]++);
  const n = items.length || 1;
  const flagged = items.length - c.good;
  const m = money(d);
  const wtd = m.ok ? weekToDate(store, d.ok) : null;
  const dates = datesFor(store, d.ok);
  const trend = dates.map((dt) => ({ label: fmtS(dt), value: Math.round(totVar(store[d.ok + "|" + dt])) }));
  const showTrend = trend.length >= 2;
  const big = items.slice().sort((a, b) => a.varrm - b.varrm)[0];
  const top = items
    .filter((x) => Math.abs(x.varrm) >= 10)
    .sort((a, b) => Math.abs(b.varrm) - Math.abs(a.varrm))
    .slice(0, 7)
    .sort((a, b) => a.varrm - b.varrm)
    .map((x) => ({ label: x.name, value: x.varrm, key: x.code }));
  const cats = [...new Set(items.map((i) => i.cat))].map((cat) => ({ cat, n: items.filter((i) => i.cat === cat).length, v: items.filter((i) => i.cat === cat).reduce((s, x) => s + x.varrm, 0) }));
  const catMax = Math.max(1, ...cats.map((x) => Math.abs(x.v)));
  const rows = items
    .filter((i) => statusOf(i)[0] !== "good")
    .sort((a, b) => RANK[statusOf(a)[0]] - RANK[statusOf(b)[0]] || a.varrm - b.varrm)
    .slice(0, 8);

  // Count & GRN checks over every loaded day (all outlets).
  const nDays = days.length || 1;
  const counted = days.filter((r) => r.counted).length;
  const grnDone = days.filter((r) => r.grn).length;
  const dedDone = days.filter((r) => r.ded).length;
  const daysMissing = days.filter((r) => !r.complete).length;
  const withData = outlets.filter((o) => o.on).length;

  const src: [string, boolean][] = [
    ["Sales", !!d.sales],
    ["Stock count", !!d.nCounts],
    ["Stock movement", !!d.mv],
    ["GRN", grnDocs.length > 0],
  ];
  const missingFiles = src.filter((x) => !x[1]).map((x) => x[0]);

  const negSum = items.filter((x) => x.varrm < 0).reduce((s, x) => s + x.varrm, 0);
  const attention: Attn[] = [];
  if (big && big.varrm < 0) {
    attention.push({
      key: "big",
      icon: AlertTriangle,
      tone: "danger",
      title: `${big.name} is short ${RM2(big.varrm).replace("−", "")}`,
      detail: `${big.sys} ${big.uom} expected, ${big.phys} counted. ${negSum ? Math.round((big.varrm / negSum) * 100) : 0}% of all shortfalls today.`,
      onPick: () => setOpenCode(big.code),
    });
  }
  if (c.crit) {
    attention.push({ key: "crit", icon: AlertTriangle, tone: "danger", title: `${c.crit} critical item${c.crit === 1 ? "" : "s"}`, detail: `Short by RM 50 or more. ${c.warn} more ${c.warn === 1 ? "is" : "are"} short by RM 10 to 50.`, href: "/variance?st=crit" });
  }
  if (m.ok && m.actPct > m.idealPct) {
    attention.push({ key: "cost", icon: Percent, tone: "warning", title: `Food cost is ${m.actPct.toFixed(1)}% of sales`, detail: `Ideal is ${m.idealPct.toFixed(1)}%, so ${(m.actPct - m.idealPct).toFixed(1)} points above recipe.`, href: "/variance" });
  }
  if (missingFiles.length) {
    attention.push({ key: "files", icon: Upload, tone: "warning", title: `${missingFiles.length} file${missingFiles.length === 1 ? "" : "s"} missing for this day`, detail: missingFiles.join(", "), href: "/upload" });
  }
  if (daysMissing) {
    attention.push({ key: "days", icon: ClipboardCheck, tone: "warning", title: `${daysMissing} of ${days.length} day${days.length === 1 ? "" : "s"} with a missing check`, detail: "Stock count, GRN or POS deductions not found.", href: "/discipline" });
  }
  if (withData < outlets.length) {
    attention.push({ key: "outlets", icon: MapPin, tone: "info", title: `${outlets.length - withData} of ${outlets.length} outlets have no data yet`, detail: "Upload their files to include them.", href: "/outlets" });
  }

  const pins: Pin[] = outlets.map((r) => ({
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

  const slices = [
    { name: "Critical", value: c.crit, color: "var(--danger)" },
    { name: "Short", value: c.warn, color: "var(--warning)" },
    { name: "On target", value: c.good, color: "var(--success)" },
    { name: "Over", value: c.info, color: "var(--muted-foreground)" },
  ];
  const costMax = m.ok ? Math.max(m.actual, m.ideal, 1) : 1;

  return (
    <>
      <PageHeader title="Dashboard" subtitle={`${d.outlet} · ${fmtD(d.date)} · where the day's food cost drifted from recipe`} />

      <Card className="gap-3 p-6 shadow-sm">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-base font-semibold">Needs your attention</h2>
          <p className="text-xs text-muted-foreground tabular-nums">{attention.length} item{attention.length === 1 ? "" : "s"}</p>
        </div>
        {attention.length ? (
          <div className="grid gap-x-10 gap-y-1 md:grid-cols-2">
            {attention.slice(0, 6).map((a) => (
              <AttentionRow key={a.key} a={a} />
            ))}
          </div>
        ) : (
          <StatusIndicator icon={CircleCheck} tone="success">
            Nothing needs attention for this day
          </StatusIndicator>
        )}
      </Card>

      <section aria-label="Summary" className="grid gap-4 lg:grid-cols-12">
        <div className="flex flex-col justify-between gap-5 rounded-xl bg-primary p-6 text-primary-foreground shadow-sm lg:col-span-5">
          <div>
            <p className="text-sm opacity-85">Food variance for the day</p>
            <p className="mt-1 font-display text-[40px] leading-tight font-bold tracking-tight tabular-nums">{RM(tot)}</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-medium">
              {tot < 0 ? <AlertTriangle aria-hidden className="size-4" /> : <CircleCheck aria-hidden className="size-4" />}
              {tot < 0 ? "Over recipe: more stock used than sales explain" : "At or under recipe"}
            </p>
          </div>
          <dl className="grid grid-cols-3 gap-3 text-sm">
            {[
              ["Food only", RM(food)],
              ["Total shortfall", RM(atRisk)],
              ["Sales", m.ok ? RM(m.sales) : "n/a"],
            ].map(([k, v]) => (
              <div key={k} className="border-l border-primary-foreground/30 pl-3">
                <dt className="opacity-85">{k}</dt>
                <dd className="text-base font-bold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
          {showTrend ? (
            <div className="text-primary-foreground">
              <p className="text-xs opacity-85">Daily food variance, {trend[0].label} to {trend[trend.length - 1].label}</p>
              <Sparkline points={trend} label={`Daily food variance for ${trend.length} days.`} />
            </div>
          ) : m.ok ? (
            <div className="flex flex-col gap-2 text-xs" role="img" aria-label={`Actual food cost ${m.actPct.toFixed(1)}% of sales against an ideal of ${m.idealPct.toFixed(1)}%.`}>
              {(
                [
                  ["Actual food cost", m.actPct, 1],
                  ["Ideal food cost", m.idealPct, 0.55],
                ] as const
              ).map(([k, v, o]) => (
                <div key={k}>
                  <div className="mb-1 flex justify-between tabular-nums">
                    <span className="opacity-85">{k}</span>
                    <b>{v.toFixed(1)}%</b>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-primary-foreground/20">
                    <i className="block h-full rounded-full bg-primary-foreground" style={{ width: `${Math.min((v / Math.max(m.actPct, m.idealPct, 1)) * 100, 100)}%`, opacity: o }} />
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex lg:col-span-7">
          <OutletMap
            pins={pins}
            selected={d.outlet}
            onSelect={(name) => {
              const r = outlets.find((o) => o.name === name);
              if (r?.on) setOutlet(r.ok);
            }}
            legend={[
              { label: "Figure: food variance of the latest day", swatch: "figure" },
              { label: "Has a critical item", swatch: "hot" },
              { label: "No data yet", swatch: "empty" },
              { label: "Selected outlet", swatch: "selected" },
            ]}
            help="Click an outlet with data to switch the dashboard to it."
          />
        </div>
      </section>

      <section aria-label="Variance charts" className="grid gap-4 lg:grid-cols-12">
        <Card className="gap-3 p-6 shadow-sm lg:col-span-7">
          <h2 className="text-base font-semibold">Biggest variances</h2>
          <p className="text-xs text-muted-foreground">Value at risk, largest first. Select a bar to open the item.</p>
          {top.length ? <VarianceBars rows={top} onPick={setOpenCode} /> : <p className="text-sm text-muted-foreground">No item is off by more than RM 10. A clean day.</p>}
        </Card>
        <Card className="gap-4 p-6 shadow-sm lg:col-span-5">
          <div>
            <h2 className="text-base font-semibold">Items by status</h2>
            <p className="text-xs text-muted-foreground">All {items.length} counted items on {fmtD(d.date)}.</p>
          </div>
          <div className="flex flex-1 flex-wrap items-center justify-center gap-x-8 gap-y-4">
            <StatusDonut slices={slices} total={items.length} caption="Items by status" />
            <ul className="flex min-w-[10rem] flex-1 flex-col gap-2 text-sm">
              {slices.map((s) => (
                <li key={s.name} className="flex items-center justify-between gap-3 tabular-nums">
                  <span className="flex items-center gap-2">
                    <i aria-hidden className="size-2.5 rounded-[3px]" style={{ background: s.color }} />
                    {s.name}
                  </span>
                  <span className="text-muted-foreground">
                    {s.value} <span className="ml-1 font-medium text-foreground">{Math.round((s.value / n) * 100)}%</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </section>

      <section aria-label="Food cost charts" className="grid gap-4 lg:grid-cols-12">
        <Card className="gap-3 p-6 shadow-sm lg:col-span-5">
          <div>
            <h2 className="text-base font-semibold">Actual vs ideal food cost</h2>
            <p className="text-xs text-muted-foreground">Share of sales spent on food.</p>
          </div>
          {m.ok ? <FoodCostBars today={m} wtd={wtd && wtd.sales !== m.sales ? wtd : null} /> : <p className="text-sm text-muted-foreground">Needs Sales, Stock Count and Stock Movement all loaded for this day.</p>}
        </Card>
        {showTrend ? (
          <Card className="gap-3 p-6 shadow-sm lg:col-span-7">
            <div>
              <h2 className="text-base font-semibold">Variance trend</h2>
              <p className="text-xs text-muted-foreground">Daily food variance for {d.outlet}.</p>
            </div>
            <TrendChart store={store} ok={d.ok} />
          </Card>
        ) : (
          <Card className="gap-4 p-6 shadow-sm lg:col-span-7">
            <div>
              <h2 className="text-base font-semibold">Variance by category</h2>
              <p className="text-xs text-muted-foreground">Net variance for food and packaging. A trend appears once two days are loaded.</p>
            </div>
            <div className="flex flex-1 flex-col justify-center gap-5">
              {cats.map((x) => (
                <div key={x.cat}>
                  <div className="flex justify-between text-sm tabular-nums">
                    <span>
                      <b>{cap(x.cat.toLowerCase())}</b> <span className="text-muted-foreground">{x.n} items</span>
                    </span>
                    <span className={cn("font-medium", x.v < 0 && "text-danger")}>{RM(x.v)}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                    <i className={cn("block h-full rounded-full", x.v < 0 ? "bg-danger" : "bg-muted-foreground")} style={{ width: `${Math.max((Math.abs(x.v) / catMax) * 100, 3)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </section>

      <section aria-label="Where things stand" className="grid gap-4 lg:grid-cols-3">
        <ProcessCard
          title="Items to check"
          href="/variance"
          value={String(flagged)}
          label={`of ${items.length} items`}
          note="Counted stock outside RM 10 of the system."
          rows={[
            { label: "Critical", tone: "danger", figure: String(c.crit), share: (c.crit / n) * 100 },
            { label: "Short", tone: "warning", figure: String(c.warn), share: (c.warn / n) * 100 },
            { label: "On target", tone: "success", figure: String(c.good), share: (c.good / n) * 100 },
          ]}
        />
        <ProcessCard
          title="Count & GRN"
          href="/discipline"
          value={`${days.length - daysMissing}/${days.length}`}
          label="days complete"
          note={daysMissing ? `${daysMissing} day${daysMissing === 1 ? "" : "s"} with a missing check.` : "Every loaded day has all three checks."}
          rows={[
            { label: "Stock counted", tone: counted === days.length ? "success" : "danger", figure: `${counted} of ${days.length}`, share: (counted / nDays) * 100 },
            { label: "GRN posted", tone: grnDone === days.length ? "success" : "warning", figure: `${grnDone} of ${days.length}`, share: (grnDone / nDays) * 100 },
            { label: "POS deductions", tone: dedDone === days.length ? "success" : "warning", figure: `${dedDone} of ${days.length}`, share: (dedDone / nDays) * 100 },
          ]}
        />
        {m.ok ? (
          <ProcessCard
            title="Food cost"
            href="/variance"
            value={RM(m.variance)}
            label={m.variance > 0 ? "over ideal" : "under ideal"}
            note={`${m.actPct.toFixed(1)}% of sales against an ideal of ${m.idealPct.toFixed(1)}%.`}
            rows={[
              { label: "Actual food", tone: m.actual > m.ideal ? "danger" : "success", figure: RM(m.actual), share: (m.actual / costMax) * 100 },
              { label: "Ideal food", tone: "success", figure: RM(m.ideal), share: (m.ideal / costMax) * 100 },
              { label: "Sales", tone: "warning", figure: RM(m.sales), share: (m.sales / Math.max(m.sales, costMax)) * 100 },
            ]}
          />
        ) : (
          <Card className="gap-1 p-5 shadow-sm">
            <h2 className="text-base font-semibold">Food cost</h2>
            <p className="text-sm text-muted-foreground">Needs Sales, Stock Count and Stock Movement all loaded for this day.</p>
          </Card>
        )}
      </section>

      <Card className="gap-3 p-6 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold">Items to check first</h2>
          <Link href="/variance" className="inline-flex items-center gap-1 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
            All {items.length} items
            <ChevronRight aria-hidden className="size-4" />
          </Link>
        </div>
        {rows.length ? (
          <div className="overflow-x-auto">
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Expected</TableHead>
                  <TableHead className="text-right">Counted</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((it) => (
                  <TableRow key={it.code} className="cursor-pointer" onClick={() => setOpenCode(it.code)}>
                    <TableCell>
                      <button type="button" className="text-left font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Open ${it.name}`}>
                        {it.name}
                      </button>
                      <div className="text-xs text-muted-foreground">{cap(it.cat.toLowerCase())}</div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{it.sys} {it.uom}</TableCell>
                    <TableCell className="text-right tabular-nums">{it.phys} {it.uom}</TableCell>
                    <TableCell className={cn("text-right font-semibold tabular-nums", it.varrm < 0 && "text-danger")}>{RM2(it.varrm)}</TableCell>
                    <TableCell className="text-center">
                      <ItemStatus item={it} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Every counted item is within RM 10 of the system.</p>
        )}
      </Card>

      <p role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {missingFiles.length ? (
          <StatusIndicator icon={CircleAlert} tone="warning">
            Missing for this day: {missingFiles.join(", ")}
          </StatusIndicator>
        ) : (
          <StatusIndicator icon={CircleCheck} tone="success">
            All 4 files loaded for this day
          </StatusIndicator>
        )}
      </p>
    </>
  );
}
