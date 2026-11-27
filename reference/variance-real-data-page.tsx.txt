"use client";

import { Search, X } from "lucide-react";
import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useData } from "@/components/data-provider";
import { FilterSelect } from "@/components/filter-select";
import { ItemStatus } from "@/components/item-status";
import { Kpis } from "@/components/kpi-strip";
import { PageHeader } from "@/components/page-header";
import { SortHead, TablePagination } from "@/components/table-parts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { useTableView } from "@/hooks/use-table-view";
import { RANK, RM, RM2, cap, fmtD, statusOf, totVar } from "@/lib/calc";
import { cn } from "@/lib/utils";

const ST_LABEL: Record<string, string> = { all: "All", flagged: "Needs checking", crit: "Critical", warn: "Short", good: "On target", info: "Surplus or over" };

function VarianceView() {
  const { cur: d, loadSample, setOpenCode } = useData();
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const st = sp.get("st") || "all";
  const cat = sp.get("cat") || "all";
  const [query, setQuery] = useState("");

  const setParam = (k: string, v: string) => {
    const p = new URLSearchParams(sp.toString());
    if (v === "all") p.delete(k);
    else p.set(k, v);
    router.replace(p.toString() ? `${path}?${p}` : path);
  };
  const clearAll = () => {
    setQuery("");
    router.replace(path);
  };

  const items = useMemo(() => d?.items ?? [], [d]);
  // The original order is the largest shortfall first.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((it) => {
        const s = statusOf(it)[0];
        if (st === "flagged" && s === "good") return false;
        if (st !== "all" && st !== "flagged" && s !== st) return false;
        if (cat !== "all" && it.cat !== cat) return false;
        if (q && !(it.name + " " + it.code + " " + it.cat).toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => a.varrm - b.varrm);
  }, [items, query, st, cat]);

  const view = useTableView(filtered, {
    resetKey: `${st}|${cat}|${query.trim().toLowerCase()}`,
    sorts: { name: (r) => r.name, sys: (r) => r.sys, phys: (r) => r.phys, varq: (r) => r.varq, value: (r) => r.varrm, status: (r) => RANK[statusOf(r)[0]] },
  });

  if (!d || !d.items) {
    return (
      <>
        <PageHeader title="Food variance" subtitle="Every counted item against what the system expects." />
        <Card className="gap-0 p-0 shadow-sm">
          <div className="px-4 py-12 text-center">
            <p className="font-semibold">No data loaded</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Upload the Stock Count file to see the full item by item variance.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button nativeButton={false} render={<Link href="/upload" />}>Go to Upload</Button>
              <Button variant="outline" onClick={loadSample}>
                Load sample day
              </Button>
            </div>
          </div>
        </Card>
      </>
    );
  }

  const c = { crit: 0, warn: 0, good: 0, info: 0 };
  items.forEach((i) => c[statusOf(i)[0]]++);
  const flagged = items.length - c.good;
  const cats = [...new Set(items.map((i) => i.cat))].sort();
  const narrowed = st !== "all" || cat !== "all" || query.trim() !== "";
  const sum = filtered.reduce((s, x) => s + x.varrm, 0);
  const pick = (v: string) => setParam("st", st === v ? "all" : v);

  return (
    <>
      <PageHeader title="Food variance" subtitle={`${d.outlet} · ${fmtD(d.date)} · expected close is what Codemax holds, counted is the physical stock take`} />

      <section aria-label="Summary" className="flex flex-col gap-2">
        <Kpis
          label="Items that need attention"
          kpis={[
            { key: "flagged", label: "items need checking", count: flagged, note: `${items.length} counted, ${flagged} outside RM 10 of the system. Total ${RM(totVar(d))}.`, tone: c.crit ? "danger" : c.warn ? "warning" : undefined, on: st === "flagged", onPick: () => pick("flagged") },
            { key: "crit", label: "critical, short by RM 50 or more", count: c.crit, note: "Items counted far below what the system expects.", tone: "danger", on: st === "crit", onPick: () => pick("crit") },
            { key: "good", label: "on target, within RM 10", count: c.good, note: "Items where the count matches the system.", on: st === "good", onPick: () => pick("good") },
          ]}
        />
        <p className="text-xs text-muted-foreground">Click a figure to filter the items. Figures are for {d.outlet} on {fmtD(d.date)}.</p>
      </section>

      <Card className="gap-0 p-0 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Search items" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search items" className="h-9 w-full pl-8 md:w-64" />
          </div>
          <FilterSelect
            boxed
            label="Status"
            value={st}
            onChange={(v) => setParam("st", v)}
            options={[
              { value: "all", label: "All", meta: String(items.length) },
              { value: "flagged", label: "Needs checking", meta: String(flagged) },
              { value: "crit", label: "Critical", meta: String(c.crit) },
              { value: "warn", label: "Short", meta: String(c.warn) },
              { value: "good", label: "On target", meta: String(c.good) },
              { value: "info", label: "Surplus or over", meta: String(c.info) },
            ]}
          />
          <FilterSelect boxed label="Category" value={cat} onChange={(v) => setParam("cat", v)} options={[{ value: "all", label: "All categories" }, ...cats.map((x) => ({ value: x, label: cap(x.toLowerCase()) }))]} />
        </div>
        {st !== "all" || cat !== "all" ? (
          <div className="flex flex-wrap items-center gap-2 border-t px-4 py-3">
            {st !== "all" ? <Chip label={`Status: ${ST_LABEL[st]}`} onClear={() => setParam("st", "all")} /> : null}
            {cat !== "all" ? <Chip label={`Category: ${cap(cat.toLowerCase())}`} onClear={() => setParam("cat", "all")} /> : null}
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={clearAll}>
              Clear all
            </Button>
          </div>
        ) : null}
      </Card>

      <Card className="gap-0 p-0 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3">
          <p aria-live="polite" className="text-sm">
            <span key={`${filtered.length}-${Math.round(sum)}`} className="animate-in fade-in duration-300">
              <b className="text-base font-semibold tabular-nums">
                {filtered.length} {filtered.length === 1 ? "item" : "items"}
              </b>
              <span className="text-muted-foreground tabular-nums"> · {RM(sum)}</span>
            </span>
            {st !== "all" ? <span className="text-muted-foreground"> · {ST_LABEL[st]}</span> : null}
            {query.trim() ? <span className="text-muted-foreground"> · matching “{query.trim()}”</span> : null}
          </p>
          {narrowed ? (
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={clearAll}>
              Clear filters
            </Button>
          ) : null}
        </div>
        <div className="overflow-x-auto px-2 pb-2">
          <Table className="min-w-[860px]">
            <TableHeader>
              <TableRow>
                <SortHead label="Item" sortKey="name" sort={view.sort} onSort={view.toggleSort} className="text-left" />
                <SortHead label="Expected" sortKey="sys" sort={view.sort} onSort={view.toggleSort} className="text-center" />
                <SortHead label="Counted" sortKey="phys" sort={view.sort} onSort={view.toggleSort} className="text-center" />
                <SortHead label="Variance qty" sortKey="varq" sort={view.sort} onSort={view.toggleSort} className="text-center" />
                <SortHead label="Value" sortKey="value" sort={view.sort} onSort={view.toggleSort} className="text-center" />
                <SortHead label="Status" sortKey="status" sort={view.sort} onSort={view.toggleSort} className="text-center" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {view.rows.map((it) => (
                <TableRow key={it.code} className="cursor-pointer" onClick={() => setOpenCode(it.code)}>
                  <TableCell className="pl-3">
                    <button
                      type="button"
                      aria-label={`Open ${it.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenCode(it.code);
                      }}
                      className="rounded text-left font-bold outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {it.name}
                    </button>
                    <span className="block text-xs text-muted-foreground">
                      {it.code} · {cap(it.cat.toLowerCase())}
                    </span>
                  </TableCell>
                  <TableCell className="text-center tabular-nums">
                    {it.sys} {it.uom}
                  </TableCell>
                  <TableCell className="text-center tabular-nums">
                    {it.phys} {it.uom}
                  </TableCell>
                  <TableCell className="text-center tabular-nums">{it.varq}</TableCell>
                  <TableCell className={cn("text-right font-bold tabular-nums", it.varrm <= -10 && "text-danger")}>{RM2(it.varrm)}</TableCell>
                  <TableCell className="text-center">
                    <ItemStatus item={it} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filtered.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="font-semibold">No items match these filters</p>
              <Button variant="outline" className="mt-4" onClick={clearAll}>
                Clear filters
              </Button>
            </div>
          ) : null}
        </div>
        <TablePagination view={view} noun="items" note="Status: critical is RM 50 or more short, short is RM 10 to RM 50, on target is within RM 10." />
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

export default function Page() {
  return (
    <Suspense fallback={null}>
      <VarianceView />
    </Suspense>
  );
}
