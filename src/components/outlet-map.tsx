"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Card } from "@/components/ui/card";
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
export function OutletMap({ pins, selected, onSelect, legend, help }: { pins: MapPin[]; selected: string; onSelect: (name: string) => void; legend: LegendItem[]; help: string }) {
  const [region, setRegion] = useState<MapRegion>("klang");
  return (
    <Card className="w-full gap-3 p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Outlet map</h2>
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
      <p className="text-xs text-muted-foreground">{help} Pin positions are approximate. Map data from OpenStreetMap.</p>
    </Card>
  );
}
