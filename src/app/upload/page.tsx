"use client";

import { Loader2, Upload as UploadIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { ChannelLogo } from "@/components/channel-parts";
import { useData } from "@/components/data-provider";
import { DateRangeFilter } from "@/components/date-range-filter";
import { FilterSelect } from "@/components/filter-select";
import { CheckStatus } from "@/components/item-status";
import { PageHeader } from "@/components/page-header";
import { FilterBar, FilterSearch } from "@/components/sales-ui";
import { SourceLogo } from "@/components/source-logo";
import { SortHead, TablePagination } from "@/components/table-parts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTableView } from "@/hooks/use-table-view";
import { dKey, fmtD, outletsOf, toIsoDate } from "@/lib/calc";
import { confirmDialog } from "@/lib/notify";
import { CHANNELS } from "@/lib/channel-mock";
import { NO_SPAN, fromIso, inSpan, isOpen, spanText, type DateSpan } from "@/lib/date-span";
import type { Day, Kind } from "@/lib/types";
import { cn } from "@/lib/utils";

// Where each file comes from. The page detects the type of every file by itself, so a card is only a place to drop files
// and a count of what is loaded. The logo says which system the file is exported from.
type Logo = { type: "img"; src: string; name: string } | { type: "channels" };
const SOURCES: { kind: Kind; title: string; hint: string; accept: string; required: boolean; logo: Logo; loaded: (d: Day) => boolean }[] = [
  { kind: "sales", title: "POS sales", hint: "Product Sales Listing, .xlsx", accept: ".xlsx,.xls", required: true, logo: { type: "img", src: "/logos/zeoniq.png", name: "Zeoniq" }, loaded: (d) => !!d.sales },
  { kind: "stockcount", title: "Stock count", hint: "Stock Count Raw Materials, AM and PM, .xlsx", accept: ".xlsx,.xls", required: true, logo: { type: "img", src: "/logos/codemax.png", name: "Codemax" }, loaded: (d) => !!d.nCounts },
  { kind: "movement", title: "Stock movement", hint: "Movement Details Raw Materials, .xlsx", accept: ".xlsx,.xls", required: true, logo: { type: "img", src: "/logos/codemax.png", name: "Codemax" }, loaded: (d) => !!d.mv },
  { kind: "grn", title: "GRN, goods received", hint: "Goods Received Note, .pdf", accept: ".pdf", required: true, logo: { type: "img", src: "/logos/codemax.png", name: "Codemax" }, loaded: (d) => !!d.grns?.length },
  { kind: "channels", title: "Sales by channel", hint: "App order export, .xlsx or .csv", accept: ".csv,.xlsx,.xls", required: false, logo: { type: "channels" }, loaded: (d) => !!d.channels },
  { kind: "checklist", title: "Checklists", hint: "Checklist Reports, .xlsx", accept: ".xlsx,.xls", required: false, logo: { type: "img", src: "/logos/treeams.png", name: "TreeAMS" }, loaded: () => false },
];
const CHANNEL_LOGOS = CHANNELS.filter((c) => c.key !== "walkin");
const SHOW_LABEL: Record<string, string> = { all: "All days", missing: "Something missing", ok: "Complete" };

const fmtTs = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(+d) ? "" : d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
};

type DayRow = { key: string; outlet: string; date: string; iso: string; sample: boolean; sales: boolean; channels: boolean; count: boolean; movement: boolean; grn: boolean; complete: boolean; items: number; by: string; at: string; files: string[] };

function SourceCard({ source, loadedText, names, over, setOver, onFiles, disabled }: { source: (typeof SOURCES)[number]; loadedText: string; names: string[]; over: boolean; setOver: (on: boolean) => void; onFiles: (files: File[]) => void; disabled: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const has = names.length > 0;
  return (
    <div
      className={cn("flex flex-col gap-3 rounded-xl border-2 border-dashed bg-card p-5 shadow-sm transition-colors", has && "border-solid border-success/60", over && "border-solid border-primary bg-primary/5")}
      aria-busy={disabled}
      onDragEnter={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = [...e.dataTransfer.files];
        if (f.length && !disabled) onFiles(f);
      }}
    >
      <div className="flex min-h-8 items-start justify-between gap-3">
        {source.logo.type === "img" ? (
          <SourceLogo src={source.logo.src} name={source.logo.name} />
        ) : (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {CHANNEL_LOGOS.map((c) => (
              <ChannelLogo key={c.key} channel={c} size="chip" />
            ))}
          </span>
        )}
        <span className="shrink-0 text-xs text-muted-foreground">{source.required ? "Required" : "Optional"}</span>
      </div>
      <div>
        <h3 className="text-sm font-semibold">{source.title}</h3>
        <p className="text-xs text-muted-foreground">{source.hint}</p>
      </div>
      <p className="text-xs tabular-nums">
        <span className="text-muted-foreground">{loadedText}</span>
      </p>
      {has ? (
        <ul aria-label={`Added this visit to ${source.title}`} className="text-xs font-medium break-all text-success">
          {names.slice(0, 2).map((n) => (
            <li key={n}>&#10003; {n}</li>
          ))}
          {names.length > 2 ? <li className="font-normal text-muted-foreground">and {names.length - 2} more</li> : null}
        </ul>
      ) : null}
      <input
        ref={input}
        type="file"
        multiple
        accept={source.accept}
        className="hidden"
        aria-label={`Choose files for ${source.title}`}
        onChange={(e) => {
          const f = [...(e.target.files || [])];
          if (f.length) onFiles(f);
          e.target.value = "";
        }}
      />
      <Button variant="outline" className="mt-auto self-start" disabled={disabled} onClick={() => input.current?.click()}>
        <UploadIcon aria-hidden /> Upload files
      </Button>
    </div>
  );
}

export default function Upload() {
  const { store, checklist, fileNames, handleFiles, loadSample, clearAll, status, progress, requests, deleteDay, requestDelete, bounds, ensureRange } = useData();
  const { isAdmin } = useAuth();
  const [over, setOver] = useState<Kind | null>(null);
  const [q, setQ] = useState("");
  const [show, setShow] = useState("all");
  const [span, setSpan] = useState<DateSpan>(NO_SPAN);
  // The table lists every saved day, so every saved day is loaded here.
  useEffect(() => {
    void ensureRange(NO_SPAN);
  }, [ensureRange]);

  const days = useMemo(() => Object.values(store), [store]);
  const nD = days.length;
  const nO = Object.keys(outletsOf(store)).length;
  const pending = useMemo(() => new Set(requests.map((r) => r.dataset_id)), [requests]);

  // One row for every saved outlet and day, newest first.
  const rows: DayRow[] = useMemo(
    () =>
      Object.keys(store)
        .map((key) => {
          const d = store[key];
          const [sales, channels, count, movement, grn] = [!!d.sales, !!d.channels, !!d.nCounts, !!d.mv, !!d.grns?.length];
          return { key, outlet: d.outlet, date: d.date, iso: toIsoDate(d.date), sample: d.sample, sales, channels, count, movement, grn, complete: sales && count && movement && grn, items: d.items?.length ?? 0, by: d.upBy ?? "", at: d.upAt ?? "", files: d.files ?? [] };
        })
        .sort((a, b) => dKey(b.date) - dKey(a.date) || a.outlet.localeCompare(b.outlet)),
    [store],
  );

  const needle = q.trim().toLowerCase();
  const filtered = rows.filter((r) => (show === "all" || (show === "ok" ? r.complete : !r.complete)) && inSpan(r.iso, span) && (!needle || (r.outlet + " " + fmtD(r.date) + " " + r.date).toLowerCase().includes(needle)));
  const missing = rows.filter((r) => !r.complete).length;
  const view = useTableView(filtered, {
    pageSize: 10,
    resetKey: `${q}|${show}|${span.from}|${span.to}`,
    sorts: { date: (r) => dKey(r.date), outlet: (r) => r.outlet, sales: (r) => Number(r.sales), channels: (r) => Number(r.channels), count: (r) => Number(r.count), movement: (r) => Number(r.movement), grn: (r) => Number(r.grn), items: (r) => r.items, at: (r) => r.at },
  });
  const isos = rows.map((r) => r.iso).filter(Boolean).sort();
  const min = bounds ? fromIso(bounds.min) : isos.length ? fromIso(isos[0]) : new Date(2026, 0, 1);
  const max = bounds ? fromIso(bounds.max) : isos.length ? fromIso(isos[isos.length - 1]) : new Date(2026, 11, 31);
  const narrowed = q !== "" || show !== "all" || !isOpen(span);
  const clearFilters = () => {
    setQ("");
    setShow("all");
    setSpan(NO_SPAN);
  };

  // What is loaded for each source, worked out from the saved days.
  const loaded = (s: (typeof SOURCES)[number]) => {
    if (s.kind === "checklist") {
      const n = Object.keys(checklist).length;
      return n ? `${n} ${n === 1 ? "outlet" : "outlets"} loaded` : "Nothing loaded yet";
    }
    const mine = days.filter(s.loaded);
    if (!mine.length) return "Nothing loaded yet";
    const last = mine.map((d) => d.date).sort((a, b) => dKey(b) - dKey(a))[0];
    return `${mine.length} ${mine.length === 1 ? "day" : "days"} loaded · latest ${fmtD(last)}`;
  };
  const clear = async () => {
    const yes = await confirmDialog({ title: "Clear all data?", text: "This removes every loaded day, including the saved copy in Supabase, for everyone. It cannot be undone.", confirmText: "Clear all data", danger: true });
    if (yes) await clearAll();
  };

  return (
    <>
      <PageHeader title="Upload data" subtitle="Drop the files of one outlet and day. The page detects each file type, joins them and works out the variance." />
      <div role="status" aria-live="polite" className="min-h-5 text-sm text-muted-foreground">
        {status || (nD ? `${nO} ${nO === 1 ? "outlet" : "outlets"}, ${nD} outlet ${nD === 1 ? "day" : "days"} loaded. Parsed in your browser and saved to your cloud.` : "Nothing loaded yet. Everything is parsed in your browser and saved to your cloud. No file leaves your machine.")}
      </div>

      {progress ? (
        <div role="status" aria-live="polite" className="flex items-start gap-3 rounded-xl border bg-card p-4 shadow-sm">
          <Loader2 aria-hidden className="mt-0.5 size-5 shrink-0 animate-spin text-primary motion-reduce:animate-none" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{progress.stage === "reading" ? `Reading file ${progress.done + 1} of ${progress.total}` : "Saving to Supabase"}</p>
            <p className="truncate text-xs text-muted-foreground">{progress.stage === "reading" ? progress.name : "Almost done. This takes a few seconds."}</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Upload progress" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done}>
              <i className={cn("block h-full rounded-full bg-primary transition-[width] duration-300", progress.stage === "saving" && "animate-pulse")} style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Please keep this page open until it finishes.</p>
          </div>
        </div>
      ) : null}

      <section aria-label="Upload files" className="flex flex-col gap-3">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SOURCES.map((s) => (
            <SourceCard key={s.kind} source={s} loadedText={loaded(s)} names={fileNames[s.kind]} over={over === s.kind} setOver={(on) => setOver(on ? s.kind : null)} onFiles={(f) => void handleFiles(f)} disabled={!!progress} />
          ))}
        </div>
        <p className="text-xs text-muted-foreground">The four required files for the same outlet and date make a day complete. Sales by channel and checklists are optional. Upload a week of files to build the history. You can also drop files on a card.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={loadSample}>
            Load sample day (Ampang)
          </Button>
          {isAdmin ? (
            <Button variant="outline" onClick={clear}>
              Clear all data
            </Button>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="saved-days" className="flex flex-col gap-3">
        <div>
          <h2 id="saved-days" className="text-base font-semibold">
            Data for each day
          </h2>
          <p className="text-sm text-muted-foreground">{isAdmin ? "As an admin you can delete a day directly." : "Staff can request a delete. An admin approves before anything is removed."}</p>
        </div>

        <FilterBar
          active={[
            ...(show !== "all" ? [{ key: "show", label: `Days: ${SHOW_LABEL[show]}`, onClear: () => setShow("all") }] : []),
            ...(!isOpen(span) ? [{ key: "span", label: `Dates: ${spanText(span)}`, onClear: () => setSpan(NO_SPAN) }] : []),
            ...(q ? [{ key: "q", label: `Search: “${q}”`, onClear: () => setQ("") }] : []),
          ]}
          onClearAll={clearFilters}
        >
          <FilterSearch value={q} onChange={setQ} placeholder="Search outlet or day" />
          <FilterSelect
            boxed
            label="Days"
            value={show}
            onChange={setShow}
            options={[
              { value: "all", label: "All days", meta: String(rows.length) },
              { value: "missing", label: "Something missing", meta: String(missing) },
              { value: "ok", label: "Complete", meta: String(rows.length - missing) },
            ]}
          />
          <DateRangeFilter label="Dates" value={span} onChange={setSpan} min={min} max={max} />
        </FilterBar>

        <Card className="gap-0 p-0 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3">
            <p aria-live="polite" className="text-sm">
              <b className="text-base font-semibold tabular-nums">
                {filtered.length} {filtered.length === 1 ? "day" : "days"}
              </b>
              {missing ? <span className="text-muted-foreground tabular-nums"> · {missing} with a file missing</span> : null}
            </p>
            {narrowed ? (
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : null}
          </div>
          <div className="overflow-x-auto px-2 pb-2">
            <Table className="min-w-[1020px]">
              <TableHeader>
                <TableRow>
                  <SortHead label="Day" sortKey="date" sort={view.sort} onSort={view.toggleSort} className="text-left" />
                  <SortHead label="Outlet" sortKey="outlet" sort={view.sort} onSort={view.toggleSort} className="text-left" />
                  <SortHead label="POS sales" sortKey="sales" sort={view.sort} onSort={view.toggleSort} className="text-left" />
                  <SortHead label="Channels" sortKey="channels" sort={view.sort} onSort={view.toggleSort} className="text-left" />
                  <SortHead label="Stock count" sortKey="count" sort={view.sort} onSort={view.toggleSort} className="text-left" />
                  <SortHead label="Movement" sortKey="movement" sort={view.sort} onSort={view.toggleSort} className="text-left" />
                  <SortHead label="GRN" sortKey="grn" sort={view.sort} onSort={view.toggleSort} className="text-left" />
                  <SortHead label="Items" sortKey="items" sort={view.sort} onSort={view.toggleSort} className="text-right" />
                  <SortHead label="Uploaded" sortKey="at" sort={view.sort} onSort={view.toggleSort} className="text-left" />
                  <TableHead className="text-right"><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {view.rows.map((r) => (
                  <TableRow key={r.key}>
                    <TableCell className="pl-3 tabular-nums">
                      {fmtD(r.date)}
                      {r.sample ? <span className="ml-2 rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium">Sample</span> : null}
                    </TableCell>
                    <TableCell className="font-medium" title={r.files.join("\n")}>{r.outlet}</TableCell>
                    <TableCell><CheckStatus ok={r.sales} yes="Loaded" no="Missing" /></TableCell>
                    <TableCell>{r.channels ? <CheckStatus ok yes="Loaded" no="Missing" /> : <span className="text-sm text-muted-foreground">None</span>}</TableCell>
                    <TableCell><CheckStatus ok={r.count} yes="Loaded" no="Missing" /></TableCell>
                    <TableCell><CheckStatus ok={r.movement} yes="Loaded" no="Missing" /></TableCell>
                    <TableCell><CheckStatus ok={r.grn} yes="Loaded" no="Missing" /></TableCell>
                    <TableCell className="text-right tabular-nums">{r.items}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.by ? <span className="block text-sm text-foreground">{r.by}</span> : null}
                      {fmtTs(r.at) || (r.by ? "" : "–")}
                    </TableCell>
                    <TableCell className="pr-3 text-right">
                      {isAdmin ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            const yes = await confirmDialog({ title: `Delete ${r.outlet}, ${fmtD(r.date)}?`, text: "This removes the day for everyone and cannot be undone.", confirmText: "Delete day", danger: true });
                            if (yes) await deleteDay(r.key);
                          }}
                        >
                          Delete
                        </Button>
                      ) : pending.has(r.key) ? (
                        <span className="text-xs font-medium text-muted-foreground">Delete requested</span>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            const yes = await confirmDialog({ title: `Ask an admin to delete ${r.outlet}, ${fmtD(r.date)}?`, text: "Nothing is removed until an admin approves.", confirmText: "Send request" });
                            if (yes) await requestDelete(r.key);
                          }}
                        >
                          Request delete
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!filtered.length ? (
              <div className="px-4 py-12 text-center">
                <p className="font-semibold">{rows.length ? "No days match these filters" : "No data saved yet"}</p>
                <p className="mt-1 text-sm text-muted-foreground">{rows.length ? "" : "Upload files above, or load the sample day."}</p>
                {rows.length ? (
                  <Button variant="outline" className="mt-4" onClick={clearFilters}>
                    Clear filters
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
          <TablePagination view={view} noun="days" note="Loaded means the file for that source is in. Channels is optional. Hover an outlet to see the files that made the day." />
        </Card>
      </section>
    </>
  );
}
