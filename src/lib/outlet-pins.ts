// What the outlet map needs for each pin. No map library is imported here, so any page can use it.
import type { Region } from "@/lib/outlet-locations";

export type MapRegion = Region | "all";

export type MapPin = {
  name: string;
  lat: number;
  lng: number;
  region: Region;
  value: string; // the figure shown in the pin, next to the name
  hot: boolean; // draws the pin with a red edge
  empty: boolean; // an outlet with no data yet is drawn as a small dot
  title: string; // the text for screen readers
  tip: string; // the tooltip text
};
