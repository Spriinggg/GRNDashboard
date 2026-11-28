"use client";

import { CalendarDays } from "lucide-react";
import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { NO_SPAN, fromIso, formatDate, isOpen, spanText, toIso, type DateSpan } from "@/lib/date-span";
import { cn } from "@/lib/utils";

const fmt = (d: Date) => formatDate(toIso(d));
function rangeText(r: DateRange) {
  const from = r.from;
  if (!from) return "";
  const to = r.to ?? from;
  return from.getTime() === to.getTime() ? fmt(from) : `${fmt(from)} to ${fmt(to)}`;
}

// A date filter for a table toolbar: a button with the label and the chosen dates, and a calendar popover to pick
// one day or a range of days. Days outside the loaded data are greyed out. "Clear" removes the filter.
export function DateRangeFilter({
  label,
  value,
  onChange,
  min,
  max,
  className,
}: {
  label: string;
  value: DateSpan;
  onChange: (value: DateSpan) => void;
  min: Date;
  max: Date;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>(undefined);
  const [month, setMonth] = useState<Date>(max);
  const on = !isOpen(value);

  function handleOpenChange(next: boolean) {
    if (next) {
      setDraft(value.from ? { from: fromIso(value.from), to: value.to ? fromIso(value.to) : undefined } : undefined);
      setMonth(value.from ? fromIso(value.from) : max);
    }
    setOpen(next);
  }
  function apply() {
    if (!draft?.from) return;
    onChange({ from: toIso(draft.from), to: toIso(draft.to ?? draft.from) });
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            aria-label={`${label}: ${on ? spanText(value) : "any date"}. Change`}
            className={cn("h-9 gap-2 rounded-lg border-border bg-card px-2.5 text-sm font-medium shadow-sm hover:bg-muted data-popup-open:bg-muted dark:bg-card dark:hover:bg-muted", className)}
          />
        }
      >
        <CalendarDays className="size-4 text-muted-foreground" aria-hidden />
        <span className="font-normal text-muted-foreground">{label}</span>
        <span className="tabular-nums">{on ? spanText(value) : "Any"}</span>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionAvoidance={{ side: "none", align: "shift", fallbackAxisSide: "none" }}
        className="max-h-(--available-height) w-[20rem] max-w-[calc(100vw-2rem)] gap-4 overflow-y-auto p-4"
      >
        <Calendar
          mode="range"
          selected={draft}
          onSelect={setDraft}
          month={month}
          onMonthChange={setMonth}
          captionLayout="dropdown"
          startMonth={min}
          endMonth={max}
          disabled={{ before: min, after: max }}
          weekStartsOn={1}
          showOutsideDays={false}
          className="w-full p-0 [--cell-size:--spacing(9)] pointer-coarse:[--cell-size:--spacing(10)]"
          classNames={{ root: "w-full" }}
        />
        <div className="sticky -bottom-4 z-10 -mx-4 -mb-4 flex flex-col gap-3 border-t border-border bg-popover px-4 py-3">
          <p className={cn("text-sm tabular-nums", !draft?.from && "text-muted-foreground")} aria-live="polite">
            {draft?.from ? rangeText(draft) : "No dates selected"}
          </p>
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2 text-muted-foreground"
              disabled={!on}
              onClick={() => {
                onChange(NO_SPAN);
                setOpen(false);
              }}
            >
              Clear
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={apply} disabled={!draft?.from}>
                Apply
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
