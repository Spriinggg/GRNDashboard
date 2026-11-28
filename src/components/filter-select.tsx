"use client";

import type { ReactNode } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type SelectOption<T extends string> = { value: T; label: string; icon?: ReactNode; meta?: string };

// The popup list is as wide as its longest option, never narrower than the button.
const listClass = "w-auto min-w-(--anchor-width) max-w-[min(92vw,28rem)]";

// A dropdown for filters: the label in grey and the choice beside it. By default it has no border at rest
// (used in the dashboard header). With `boxed` it is drawn as a small card so it is easy to spot.
// Built on the shadcn Select, so it works with the keyboard and reads well to screen readers.
export function FilterSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  boxed = false,
  disabled = false,
  className,
}: {
  label: string;
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  boxed?: boolean;
  // Locks the choice, for example when a person may only see one outlet.
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Select
      items={options}
      value={value}
      disabled={disabled}
      onValueChange={(v) => {
        if (v) onChange(v as T);
      }}
    >
      <SelectTrigger
        aria-label={label}
        className={cn(
          "gap-2 rounded-lg px-2.5 text-sm font-medium data-[size=default]:h-9",
          boxed
            ? "border-border bg-card shadow-sm hover:bg-muted data-popup-open:bg-muted dark:bg-card dark:hover:bg-muted"
            : "border-transparent bg-transparent shadow-none hover:bg-muted data-popup-open:bg-muted dark:bg-transparent dark:hover:bg-muted",
          className,
        )}
      >
        <span className="font-normal text-muted-foreground">{label}</span>
        <SelectValue />
        {options.find((o) => o.value === value)?.icon}
        {options.find((o) => o.value === value)?.meta ? <span className="tabular-nums">{options.find((o) => o.value === value)?.meta}</span> : null}
      </SelectTrigger>
      <SelectContent align="start" alignItemWithTrigger={false} className={listClass}>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
            {o.icon}
            {o.meta ? <span className="tabular-nums text-muted-foreground">{o.meta}</span> : null}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// A dropdown for forms and table cells. Pair it with a visible label (<Field id=...>) or give it `ariaLabel`.
export function FieldSelect<T extends string>({
  id,
  ariaLabel,
  value,
  options,
  onChange,
  size = "default",
  className,
}: {
  id?: string;
  ariaLabel?: string;
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  size?: "default" | "sm";
  className?: string;
}) {
  return (
    <Select
      items={options}
      value={value}
      onValueChange={(v) => {
        if (v) onChange(v as T);
      }}
    >
      <SelectTrigger
        id={id}
        aria-label={ariaLabel}
        size={size}
        className={cn(
          "w-full rounded-lg border-border bg-card px-3 text-sm shadow-none hover:bg-muted data-popup-open:bg-muted data-[size=default]:h-9 dark:bg-card dark:hover:bg-muted",
          className,
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="start" alignItemWithTrigger={false} className={listClass}>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Turns a plain list of names into options.
export const toOptions = <T extends string>(list: readonly T[]): SelectOption<T>[] => list.map((v) => ({ value: v, label: v }));
