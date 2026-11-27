"use client";

import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fmtDelta } from "@/components/drill-chart";
import { cn } from "@/lib/utils";

// Small pieces shared by the two Sales pages. The filter section is built the same way as on Food variance,
// Count & GRN and Outlets: one card, a toolbar with a search box and boxed dropdowns (FilterSelect), then
// removable chips for what is switched on, with "Clear all".

// `label` is the words, used for screen readers. `node` replaces the words on screen when a logo says it better.
export type ActiveFilter = { key: string; label: string; node?: React.ReactNode; onClear: () => void };

export function FilterBar({ children, extra, active, onClearAll, summary }: { children: React.ReactNode; extra?: React.ReactNode; active: ActiveFilter[]; onClearAll: () => void; summary?: React.ReactNode }) {
  return (
    <Card className="gap-0 p-0 shadow-sm" role="search" aria-label="Filters">
      <div className="flex flex-wrap items-center gap-2 p-4">{children}</div>
      {extra ? <div className="flex flex-wrap items-center gap-2 border-t px-4 py-3">{extra}</div> : null}
      {active.length ? (
        <div className="flex flex-wrap items-center gap-2 border-t px-4 py-3">
          {active.map((a) => (
            <Chip key={a.key} label={a.label} node={a.node} onClear={a.onClear} />
          ))}
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onClearAll}>
            Clear all
          </Button>
        </div>
      ) : null}
      {summary ? (
        <p role="status" aria-live="polite" className="border-t px-4 py-2.5 text-xs text-muted-foreground tabular-nums">
          {summary}
        </p>
      ) : null}
    </Card>
  );
}

export function FilterSearch({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input aria-label={placeholder} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-9 w-full pl-8 md:w-64" />
    </div>
  );
}

export function Chip({ label, node, onClear }: { label: string; node?: React.ReactNode; onClear: () => void }) {
  return (
    <button
      type="button"
      onClick={onClear}
      aria-label={`Remove filter: ${label}`}
      className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs font-medium outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
    >
      {node ?? label}
      <X aria-hidden className="size-3" />
    </button>
  );
}

// A short set of choices where exactly one is selected (used for chart controls, not for filters).
export function Seg<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border bg-background p-0.5 text-sm">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn("rounded-md px-2.5 py-1 font-medium whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring", o.value === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Several choices that can each be on or off. A choice shows `node` (a logo) or a colour dot. With `labelHidden` the
// words are left off the screen because the node already says them, and stay as the accessible name.
export type ChipOption<T extends string> = { value: T; label: string; color?: string; node?: React.ReactNode; labelHidden?: boolean };
export function Chips<T extends string>({ label, options, value, onChange }: { label: string; options: ChipOption<T>[]; value: T[]; onChange: (v: T[]) => void }) {
  const toggle = (v: T) => {
    const on = value.includes(v);
    if (on && value.length === 1) return; // keep at least one
    onChange(on ? value.filter((x) => x !== v) : [...value, v]);
  };
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-sm text-muted-foreground">{label}</span>
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            aria-label={o.labelHidden ? o.label : undefined}
            onClick={() => toggle(o.value)}
            className={cn("inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring", on ? "border-foreground/30 bg-card text-foreground shadow-sm" : "bg-transparent text-muted-foreground opacity-60 grayscale hover:opacity-100 hover:grayscale-0")}
          >
            {o.node ?? <i aria-hidden className="size-2.5 rounded-full" style={{ background: o.color ?? "var(--primary)", opacity: on ? 1 : 0.35 }} />}
            {o.labelHidden ? null : o.label}
          </button>
        );
      })}
    </div>
  );
}


export function Delta({ d }: { d: number | null }) {
  if (d === null) return <span className="text-muted-foreground">–</span>;
  return (
    <span className={cn("tabular-nums", d >= 0 ? "text-muted-foreground" : "font-medium text-danger")}>
      {d >= 0 ? "▲" : "▼"} {fmtDelta(d).slice(1)}
    </span>
  );
}
