"use client";

import dynamic from "next/dynamic";
import { Search } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { REGION_LABEL } from "@/lib/outlet-locations";
import type { MapPin, MapRegion } from "@/lib/outlet-pins";
import { cn } from "@/lib/utils";

// Leaflet needs the browser, so the map itself is loaded on the client only.
const OutletMapView = dynamic(() => import("@/components/outlet-map-view"), {
  ssr: false,
  loading: () => <Skeleton className="size-full min-h-[320px] rounded-lg" />,
});

const regions: { key: MapRegion; label: string }[] = [
  { key: "klang", label: REGION_LABEL.klang },
  { key: "north", label: REGION_LABEL.north },
  { key: "south", label: REGION_LABEL.south },
  { key: "all", label: "All" },
];

export type LegendItem = { label: string; swatch: "figure" | "hot" | "empty" | "selected" };
const swatch: Record<LegendItem["swatch"], string> = {
  figure: "rounded-[3px] border-2 border-primary bg-card",
  hot: "rounded-[3px] border-2 border-danger bg-card",
  empty: "rounded-full border-2 border-muted-foreground bg-card",
  selected: "rounded-[3px] bg-primary",
};

// The outlet filter drawn as a map. The page decides what each pin shows (a figure, a red edge, a small dot for an
// outlet with no data) and what the tooltip says. Pressing a pin selects the outlet, pressing it again clears the choice.
//
// `onClear` is given by pages where the choice can be let go. It lets Escape clear the choice (a typed search is cleared first).
export function OutletMap({ pins, selected, onSelect, onClear, legend, help, title = "Outlet map", extra }: { pins: MapPin[]; selected: string; onSelect: (name: string) => void; onClear?: () => void; legend: LegendItem[]; help: string; title?: string; extra?: React.ReactNode }) {
  const [region, setRegion] = useState<MapRegion>("klang");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const needle = q.trim().toLowerCase();
  const found = useMemo(() => (needle ? pins.filter((p) => p.name.toLowerCase().includes(needle)).slice(0, 8) : []), [pins, needle]);

  const choose = (p: MapPin) => {
    setQ("");
    setOpen(false);
    setRegion(p.region);
    if (p.name !== selected) onSelect(p.name); // onSelect toggles on some pages, so never send the one already chosen
  };

  // Escape lets go of the chosen outlet. Not while a dialog or sheet is open, because Escape closes that first.
  useEffect(() => {
    if (!onClear || !selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (document.querySelector('[role="dialog"], [data-slot="sheet-content"]')) return;
      onClear();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClear, selected]);

  return (
    <Card className="w-full gap-3 p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{title}</h2>
        <div className="relative order-last w-full sm:order-none sm:w-60">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            role="combobox"
            aria-label="Search outlets on the map"
            aria-expanded={open && found.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && found[active] ? `${listId}-${active}` : undefined}
            autoComplete="off"
            placeholder="Search outlets"
            value={q}
            className="h-9 w-full pl-8"
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
              setActive(0);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" && found.length) {
                e.preventDefault();
                setOpen(true);
                setActive((i) => (i + 1) % found.length);
              } else if (e.key === "ArrowUp" && found.length) {
                e.preventDefault();
                setActive((i) => (i - 1 + found.length) % found.length);
              } else if (e.key === "Enter" && open && found[active]) {
                e.preventDefault();
                choose(found[active]);
              } else if (e.key === "Escape" && q) {
                e.preventDefault(); // the first Escape clears the search, the next one clears the chosen outlet
                setQ("");
                setOpen(false);
              }
            }}
          />
          {open && needle ? (
            <ul id={listId} role="listbox" aria-label="Matching outlets" className="absolute z-[1000] mt-1 max-h-64 w-full overflow-auto rounded-lg border bg-popover p-1 text-sm text-popover-foreground shadow-md">
              {found.length ? (
                found.map((p, i) => (
                  <li
                    key={p.name}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === active}
                    onMouseDown={(e) => {
                      e.preventDefault(); // keep focus in the box so the click is not lost to the blur
                      choose(p);
                    }}
                    onMouseEnter={() => setActive(i)}
                    className={cn("flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5", i === active && "bg-muted")}
                  >
                    <span className="truncate">{p.name}</span>
                    {p.empty ? <span className="shrink-0 text-xs text-muted-foreground">No data</span> : p.name === selected ? <span className="shrink-0 text-xs text-primary">Chosen</span> : null}
                  </li>
                ))
              ) : (
                <li className="px-2 py-1.5 text-muted-foreground">No outlet matches “{q.trim()}”</li>
              )}
            </ul>
          ) : null}
        </div>
        <div role="group" aria-label="Map area" className="flex gap-1 rounded-lg bg-muted p-1">
          {regions.map((r) => (
            <button
              key={r.key}
              type="button"
              aria-pressed={region === r.key}
              onClick={() => setRegion(r.key)}
              className={cn(
                "rounded-md px-3 py-1 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                region === r.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      {extra}
      <div className="isolate min-h-[320px] flex-1 overflow-hidden rounded-lg">
        <OutletMapView pins={pins} selected={selected} region={region} onSelect={onSelect} />
      </div>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {legend.map((l) => (
          <span key={l.label} className="flex items-center gap-1.5">
            <i aria-hidden className={cn("inline-block size-2.5", swatch[l.swatch])} /> {l.label}
          </span>
        ))}
      </p>
      <p className="text-xs text-muted-foreground">{help}{onClear ? " Press Esc to clear the choice." : ""} Pin positions are approximate. Map data from OpenStreetMap.</p>
    </Card>
  );
}
