"use client";

import { AlertTriangle, ArrowRight, CircleAlert, CircleCheck, CircleSlash } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useData } from "@/components/data-provider";
import { ItemStatus } from "@/components/item-status";
import { StatusIndicator } from "@/components/status-indicator";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { RM, RM2, fmtD, money, signTone, statusOf, toIsoDate, weekToDate } from "@/lib/calc";
import { dayRows } from "@/lib/checks";
import { LAST_D, LAST_M, OUTLETS } from "@/lib/overview-mock";
import { labourGrid, aggregate as labourAgg, pctOf as labourPct, TARGET as LABOUR_TARGET } from "@/lib/labour-mock";
import { REGION_LABEL } from "@/lib/outlet-locations";
import type { OutletRow, OutletStatus } from "@/lib/outlets";
import { aggregate as treamsAgg, pctOf as treamsPct, TARGET as TREAMS_TARGET, treamsGrid } from "@/lib/treeams-mock";
import { cn } from "@/lib/utils";

export function OutletState({ s }: { s: OutletStatus }) {
  if (s === "crit") return <StatusIndicator icon={AlertTriangle} tone="danger">Critical</StatusIndicator>;
  if (s === "warn") return <StatusIndicator icon={CircleAlert} tone="warning">Short</StatusIndicator>;
  if (s === "good") return <StatusIndicator icon={CircleCheck} tone="success">On target</StatusIndicator>;
  return <StatusIndicator icon={CircleSlash} tone="muted">No data yet</StatusIndicator>;
}

// The card of one outlet. Opens from the right, from a pin on the map or a row of the table. Escape closes it.
// Four blocks: how the latest day looks, whether the last seven days are complete, a few scores, and a way to the dashboard.
export function OutletSheet({ row, onClose }: { row: OutletRow | null; onClose: () => void }) {
  return (
    <Sheet open={row !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto">{row ? <Card row={row} onClose={onClose} /> : null}</SheetContent>
    </Sheet>
  );
}

const SEVEN = 7;
const DAY_MS = 86_400_000;

// A score with a word, a figure and a dot only when it needs a look. `sample` marks figures that are not from real files yet.
function Score({ label, figure, note, tone, sample }: { label: string; figure: string; note: string; tone?: "warning" | "danger"; sample?: boolean }) {
  return (
    <li className="flex items-start justify-between gap-4 px-3 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {label}
          {sample ? <span className="ml-2 rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-foreground">Sample data</span> : null}
        </p>
        <p className="text-xs text-muted-foreground">{note}</p>
      </div>
      <p className="flex shrink-0 items-center gap-1.5 text-base font-semibold tabular-nums">
        {tone ? <i aria-hidden className={cn("size-2 rounded-full", tone === "danger" ? "bg-danger" : "bg-warning")} /> : null}
        {figure}
      </p>
    </li>
  );
}

function Card({ row, onClose }: { row: OutletRow; onClose: () => void }) {
  const { store, grnDocs, setOutlet } = useData();
  const router = useRouter();
  const day = row.last ? store[row.ok + "|" + row.last] : null;

  // The three checks for each of the seven days that end on the latest loaded day.
  const week = useMemo(() => {
    if (!row.last) return null;
    const rows = dayRows(store, grnDocs).filter((r) => r.ok === row.ok);
    const byIso = new Map(rows.map((r) => [r.iso, r]));
    const end = Date.UTC(+toIsoDate(row.last).slice(0, 4), +toIsoDate(row.last).slice(5, 7) - 1, +toIsoDate(row.last).slice(8, 10));
    const days = Array.from({ length: SEVEN }, (_, i) => {
      const t = new Date(end - (SEVEN - 1 - i) * DAY_MS);
      const iso = t.toISOString().slice(0, 10);
      return { iso, label: String(t.getUTCDate()), row: byIso.get(iso) ?? null };
    });
    const checks = [
      { key: "count", label: "Stock count", ok: (r: (typeof rows)[number]) => r.counted },
      { key: "grn", label: "GRN", ok: (r: (typeof rows)[number]) => r.grn },
      { key: "ded", label: "POS deductions", ok: (r: (typeof rows)[number]) => r.ded },
    ];
    return { days, checks, complete: days.filter((d) => d.row?.complete).length };
  }, [store, grnDocs, row.ok, row.last]);

  const shortItems = useMemo(() => (day?.items ?? []).filter((i) => statusOf(i)[0] === "crit" || statusOf(i)[0] === "warn").sort((a, b) => a.varrm - b.varrm).slice(0, 3), [day]);

  // Food cost comes from the real files. It needs sales and the stock movement file for the day.
  const mon = day ? money(day) : null;
  const wtd = row.on ? weekToDate(store, row.ok) : null;
  const fc = mon && mon.ok ? mon : null;
  const fcOver = fc ? fc.actPct - fc.idealPct : 0;

  // Treeams and labour are sample data until their reports are loaded. Both use the month to date.
  const oi = OUTLETS.findIndex((o) => o.name.toLowerCase() === row.name.toLowerCase());
  const treams = useMemo(() => (oi < 0 ? null : treamsPct(treamsAgg(treamsGrid([[LAST_M, 1, LAST_D]]), [oi]))), [oi]);
  const labour = useMemo(() => (oi < 0 ? null : labourPct(labourAgg(labourGrid([[LAST_M, 1, LAST_D]]), [oi]))), [oi]);

  const openDashboard = () => {
    setOutlet(row.ok);
    onClose();
    router.push("/");
  };

  return (
    <>
      <SheetHeader className="border-b pr-12">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Image src="/logo.svg" alt="US Pizza" width={58} height={38} className="h-9 w-auto rounded-md bg-white p-0.5 ring-1 ring-border" />
          <OutletState s={row.status} />
        </div>
        <SheetTitle className="font-display text-2xl font-bold">{row.name}</SheetTitle>
        <SheetDescription>
          {row.area} &middot; {REGION_LABEL[row.region]} &middot; Manager <span className="text-xs">Planned</span>
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-col gap-6 p-4">
        <section aria-label="Latest day">
          <h3 className="mb-3 text-base font-semibold">{row.on && row.last ? `Latest day, ${fmtD(row.last)}` : "Latest day"}</h3>
          {row.on ? (
            <>
              <dl className="divide-y rounded-lg border text-sm">
                <div className="flex justify-between px-3 py-2.5">
                  <dt className="text-muted-foreground">Food variance</dt>
                  <dd className={cn("font-semibold tabular-nums", signTone(row.total))}>{RM(row.total)}</dd>
                </div>
                <div className="flex justify-between px-3 py-2.5">
                  <dt className="text-muted-foreground">Items flagged</dt>
                  <dd className="font-semibold tabular-nums">
                    {row.flagged}
                    {row.crit ? <span className="font-normal text-muted-foreground"> · {row.crit} critical</span> : null}
                  </dd>
                </div>
              </dl>
              {shortItems.length ? (
                <ol aria-label="Items most short" className="mt-3 divide-y rounded-lg border text-sm">
                  {shortItems.map((i) => (
                    <li key={i.code} className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{i.name}</span>
                        <span className={cn("text-xs tabular-nums", signTone(i.varrm) || "text-muted-foreground")}>{RM2(i.varrm)}</span>
                      </span>
                      <ItemStatus item={i} />
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-3 rounded-lg bg-muted p-3 text-sm text-muted-foreground">No item is short on this day.</p>
              )}
            </>
          ) : (
            <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">Nothing has been uploaded for this outlet yet. Upload the stock count, stock movement and sales files on the Upload page.</p>
          )}
        </section>

        <section aria-label="Data for the last seven days">
          <h3 className="mb-1 text-base font-semibold">Is the data complete?</h3>
          {week ? (
            <>
              <p className="mb-3 text-xs text-muted-foreground">
                {week.complete} of {SEVEN} days have the stock count, the GRN and the POS deductions.
              </p>
              <div role="table" aria-label="Checks for the last seven days" className="rounded-lg border p-3 text-sm">
                <div role="row" className="grid grid-cols-[7.5rem_repeat(7,1fr)] items-center gap-1 pb-1.5 text-xs text-muted-foreground">
                  <span role="columnheader" />
                  {week.days.map((d) => (
                    <span key={d.iso} role="columnheader" className="text-center tabular-nums">{d.label}</span>
                  ))}
                </div>
                {week.checks.map((c) => (
                  <div key={c.key} role="row" className="grid grid-cols-[7.5rem_repeat(7,1fr)] items-center gap-1 py-1">
                    <span role="rowheader" className="text-sm">{c.label}</span>
                    {week.days.map((d) => {
                      const has = !!d.row;
                      const ok = has && c.ok(d.row!);
                      return (
                        <span key={d.iso} role="cell" className="flex justify-center">
                          <i
                            title={`${c.label}, ${d.label}: ${!has ? "no file" : ok ? "done" : "missing"}`}
                            className={cn("flex size-5 items-center justify-center rounded-full text-[11px] leading-none font-bold", ok ? "bg-success/30" : has ? "bg-warning/60" : "bg-muted")}
                          >
                            <span className="sr-only">{!has ? "No file" : ok ? "Done" : "Missing"}</span>
                            <span aria-hidden>{ok ? "✓" : has ? "!" : ""}</span>
                          </i>
                        </span>
                      );
                    })}
                  </div>
                ))}
              </div>
              <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><i aria-hidden className="inline-block size-2.5 rounded-full bg-success/30" /> Done</span>
                <span className="flex items-center gap-1.5"><i aria-hidden className="inline-block size-2.5 rounded-full bg-warning/60" /> Missing</span>
                <span className="flex items-center gap-1.5"><i aria-hidden className="inline-block size-2.5 rounded-full bg-muted" /> No file that day</span>
              </p>
            </>
          ) : (
            <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">No day is loaded yet, so there is nothing to check.</p>
          )}
        </section>

        <section aria-label="Scores">
          <h3 className="mb-3 text-base font-semibold">How is it doing?</h3>
          <ul className="divide-y rounded-lg border">
            {fc ? (
              <Score
                label="Food cost"
                figure={`${fc.actPct.toFixed(1)}%`}
                note={`Ideal ${fc.idealPct.toFixed(1)}%${wtd && wtd.days > 1 ? ` · week to date ${wtd.actPct.toFixed(1)}%` : ""}`}
                tone={fcOver > 2 ? "danger" : fcOver > 0.5 ? "warning" : undefined}
              />
            ) : (
              <Score label="Food cost" figure="–" note="Needs the sales and stock movement files for the latest day" />
            )}
            {treams !== null ? <Score sample label="Treeams checklists" figure={`${treams.toFixed(0)}%`} note={`Tasks done, target ${TREAMS_TARGET}%`} tone={treams < TREAMS_TARGET - 5 ? "danger" : treams < TREAMS_TARGET ? "warning" : undefined} /> : null}
            {labour !== null ? <Score sample label="Labour share" figure={`${labour.toFixed(1)}%`} note={`Of net sales, target under ${LABOUR_TARGET}%`} tone={labour > LABOUR_TARGET + 3 ? "danger" : labour > LABOUR_TARGET ? "warning" : undefined} /> : null}
          </ul>
        </section>

        <Button onClick={openDashboard} disabled={!row.on} className="self-start">
          Open the dashboard <ArrowRight aria-hidden />
        </Button>
        {!row.on ? <p className="-mt-3 text-xs text-muted-foreground">The dashboard opens once this outlet has data.</p> : null}
      </div>
    </>
  );
}
