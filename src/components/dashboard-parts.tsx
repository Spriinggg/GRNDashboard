"use client";

import { ArrowRight, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { signTone } from "@/lib/calc";
import type { DateSpan } from "@/lib/date-span";
import { cn } from "@/lib/utils";

export type RowTone = "danger" | "warning" | "success" | "muted" | "primary";
const bar: Record<RowTone, string> = { danger: "bg-danger", warning: "bg-warning", success: "bg-success", muted: "bg-muted-foreground/50", primary: "bg-primary" };

export type OverviewRow = { key: string; label: React.ReactNode; figure: React.ReactNode; share?: number; tone?: RowTone };

// A change against the dates before. `good` says whether a rise is good news. A measure where a rise is bad (food short, labour
// share) is shown in plain text, because the sign colour rule would paint a bad rise green.
export type Change = { text: string; n: number; good?: boolean };

// The card of one page: its name as a link, one headline figure, what changed, an interactive chart and, only where a chart
// does not say it, a few rows. The footer link opens the full page. `sample` marks a card built on generated figures.
export function OverviewCard({ title, href, linkText = "View details", sample, value, label, change, note, visual, rows, empty, className }: { title: string; href: string; linkText?: string; sample?: boolean; value: React.ReactNode; label: string; change?: Change | null; note?: string; visual?: React.ReactNode; rows?: OverviewRow[]; empty?: string; className?: string }) {
  return (
    <Card className={cn("gap-4 p-5 shadow-sm", className)}>
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-semibold">
          <Link href={href} className="inline-flex items-center gap-1 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
            {title}
            <ChevronRight aria-hidden className="size-4 text-muted-foreground" />
          </Link>
        </h2>
        {sample ? <span className="shrink-0 rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-foreground">Sample data</span> : null}
      </div>
      {empty ? (
        <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <>
          <div>
            <p className="flex flex-wrap items-baseline gap-x-2 tabular-nums">
              <span className="text-2xl leading-tight font-semibold">{value}</span>
              <span className="text-sm text-muted-foreground">{label}</span>
            </p>
            {change ? (
              <p className={cn("text-xs tabular-nums", change.good === false ? "text-muted-foreground" : signTone(change.n) || "text-muted-foreground")}>
                {change.n > 0 ? "▲" : change.n < 0 ? "▼" : "–"} {change.text}
              </p>
            ) : null}
            {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
          </div>
          {visual}
          {rows && rows.length ? (
            <ul className="flex flex-col gap-3">
              {rows.map((r) => (
                <li key={r.key}>
                  <div className="flex items-center justify-between gap-3 text-sm tabular-nums">
                    <span className="flex min-w-0 items-center gap-2">
                      {r.tone ? <i aria-hidden className={cn("size-2 shrink-0 rounded-full", bar[r.tone])} /> : null}
                      <span className="min-w-0 truncate">{r.label}</span>
                    </span>
                    <span className="shrink-0 font-medium">{r.figure}</span>
                  </div>
                  {r.share !== undefined ? (
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                      <i className={cn("block h-full rounded-full", bar[r.tone ?? "muted"])} style={{ width: `${Math.max(Math.min(r.share, 100), r.share ? 3 : 0)}%` }} />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
      <Link href={href} className="mt-auto inline-flex items-center gap-1 self-start rounded text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
        {linkText}
        <ArrowRight aria-hidden className="size-4" />
      </Link>
    </Card>
  );
}

export type Preset = { key: string; label: string; span: DateSpan };

// Quick choices for the dates. The one that matches the dates now is pressed. A custom range from the calendar presses none.
export function PresetGroup({ presets, value, onPick }: { presets: Preset[]; value: DateSpan; onPick: (span: DateSpan) => void }) {
  const on = presets.find((p) => p.span.from === value.from && p.span.to === value.to)?.key ?? "";
  return <Segmented label="Quick dates" options={presets} value={on} onChange={(key) => onPick(presets.find((p) => p.key === key)!.span)} />;
}

// A row of choices where one is on, drawn like the map's area switch.
export function Segmented<T extends string>({ label, options, value, onChange }: { label: string; options: { key: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1 self-start rounded-lg bg-muted p-1">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={value === o.key}
          onClick={() => onChange(o.key)}
          className={cn("rounded-md px-3 py-1 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring", value === o.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
