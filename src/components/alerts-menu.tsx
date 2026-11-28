"use client";

import { Bell, CircleCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAlerts } from "@/hooks/use-alerts";
import type { Alert } from "@/hooks/use-alerts";
import { cn } from "@/lib/utils";

const dot: Record<Alert["tone"], string> = { danger: "bg-danger", warning: "bg-warning", info: "bg-muted-foreground/60" };

// The bell in the top bar. The number is how many alerts need a look, in red when one is serious. The list opens under it,
// each alert a link to the page where it can be dealt with.
export function AlertsMenu() {
  const { alerts, scope, ready } = useAlerts();
  const [open, setOpen] = useState(false);
  const serious = alerts.some((a) => a.tone === "danger");
  const n = alerts.filter((a) => a.tone !== "info").length || alerts.length;
  const word = !ready ? "Alerts" : alerts.length ? `${alerts.length} ${alerts.length === 1 ? "alert" : "alerts"}` : "No alerts";
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger aria-label={word} title={word} className="relative grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-popup-open:bg-muted data-popup-open:text-foreground">
        <Bell aria-hidden className="size-[18px]" />
        {alerts.length ? (
          <span aria-hidden className={cn("absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full px-1 text-[10px] leading-4 font-semibold text-white", serious ? "bg-danger" : "bg-foreground/80")}>
            {n}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] max-w-[calc(100vw-1.5rem)] gap-0 p-0">
        <div className="flex items-baseline justify-between gap-3 border-b px-3 py-2.5">
          <p className="text-sm font-semibold">Alerts</p>
          <p className="text-xs text-muted-foreground">{scope}</p>
        </div>
        {alerts.length ? (
          <ul aria-label="Alerts" className="max-h-[min(24rem,70vh)] overflow-y-auto p-1">
            {alerts.map((a) => (
              <li key={a.key}>
                <Link href={a.href} onClick={() => setOpen(false)} className="flex items-start gap-3 rounded-md px-2.5 py-2 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
                  <i aria-hidden className={cn("mt-1.5 size-2 shrink-0 rounded-full", dot[a.tone])} />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{a.title}</span>
                    <span className="block text-xs text-muted-foreground">{a.detail}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground">
            <CircleCheck aria-hidden className="size-4 text-success" />
            {ready ? "Nothing needs a look" : "Checking"}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
