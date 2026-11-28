"use client";

// The Leaflet map. It touches the browser window, so it is only loaded on the client (see outlet-map-card.tsx).
//
// It uses plain Leaflet inside effects (not react-leaflet). Next.js "cacheComponents" keeps a page that the user
// left in a hidden <Activity>, which runs every effect cleanup when hiding and every effect again when showing.
// react-leaflet creates its map once and removes it in a cleanup, so coming back to this page gave
// "Map container is being reused" and "Cannot read properties of undefined (reading 'appendChild')".
// Here every effect creates what it needs and removes it in its own cleanup, so hide and show are safe.
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { MapPin, MapRegion } from "@/lib/outlet-pins";

// Each pin shows the outlet name and a figure, so the status is never colour alone.
// Built as DOM nodes with textContent, never as an HTML string, so an outlet name can never inject markup.
function pinIcon(p: MapPin, selected: boolean) {
  const pin = document.createElement("div");
  pin.className = "outlet-pin";
  pin.dataset.hot = String(p.hot);
  pin.dataset.selected = String(selected);
  pin.dataset.empty = String(p.empty);
  // Every outlet carries the US Pizza logo. The name and figure are only added when the outlet has data.
  const logo = document.createElement("img");
  logo.src = "/logo.svg";
  logo.alt = "";
  logo.className = "outlet-pin-logo";
  logo.draggable = false;
  pin.append(logo);
  if (p.empty) return L.divIcon({ className: "", iconSize: [0, 0], html: pin });
  const name = document.createElement("span");
  name.textContent = p.name;
  const figure = document.createElement("b");
  figure.textContent = p.value;
  pin.append(name, figure);  return L.divIcon({ className: "", iconSize: [0, 0], html: pin });
}

function tipText(text: string) {
  const el = document.createElement("span");
  el.textContent = text;
  el.style.whiteSpace = "pre"; // a new line in the text starts a new line in the tooltip, and lines are not wrapped
  return el;
}

export default function OutletMapView({
  pins,
  selected,
  region,
  onSelect,
  compact = false,
}: {
  pins: MapPin[];
  selected: string;
  region: MapRegion;
  onSelect: (name: string) => void;
  compact?: boolean; // a shorter map, for a small card
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelect);
  const pinsRef = useRef(pins);
  // The map only moves when the set of outlets, the area or the selected outlet changes, not on every new array of pins.
  const outletKey = pins.map((p) => p.name).join("|");

  useEffect(() => {
    onSelectRef.current = onSelect;
    pinsRef.current = pins;
  });

  // 1. The map itself. Created when the page is shown, removed when it is hidden or left.
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const first = pinsRef.current[0];
    const map = L.map(box, { center: first ? [first.lat, first.lng] : [3.14, 101.69], zoom: 10, scrollWheelZoom: false });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    const layer = L.layerGroup().addTo(map);
    // The pins shrink when the map is zoomed out, because 44 outlets sit close together in the Klang Valley.
    const size = () => box.setAttribute("data-zoom", map.getZoom() >= 14 ? "near" : map.getZoom() >= 12 ? "mid" : "far");
    size();
    map.on("zoomend", size);
    mapRef.current = map;
    layerRef.current = layer;
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  // 2. The pins. Rebuilt when the figures or the selected outlet change (and after the map is re-created).
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();
    for (const p of pins) {
      // Outlets with a figure and the chosen outlet are drawn above the plain ones, and any pin rises when pointed at.
      L.marker([p.lat, p.lng], { icon: pinIcon(p, p.name === selected), title: p.title, riseOnHover: true, zIndexOffset: p.name === selected ? 2000 : p.empty ? 0 : 1000 })
        .on("click", () => onSelectRef.current(p.name))
        .bindTooltip(tipText(p.tip), { direction: "bottom", offset: [0, 6] })
        .addTo(layer);
    }
  }, [pins, selected]);

  // 3. Moves the map when the region switch or the selected outlet changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const pins = pinsRef.current;
    const one = pins.find((p) => p.name === selected);
    if (one) {
      map.flyTo([one.lat, one.lng], 14, { duration: 0.6 });
      return;
    }
    const group = pins.filter((p) => region === "all" || p.region === region);
    const use = group.length > 0 ? group : pins;
    if (use.length === 0) return;
    if (use.length === 1) map.flyTo([use[0].lat, use[0].lng], 13, { duration: 0.6 });
    else map.flyToBounds(L.latLngBounds(use.map((p) => [p.lat, p.lng] as [number, number])), { padding: [60, 60], duration: 0.6, maxZoom: 13 });
  }, [outletKey, region, selected]);

  return <div ref={boxRef} role="region" aria-label="Map of the outlets" className={compact ? "size-full min-h-[230px] rounded-lg" : "size-full min-h-[320px] rounded-lg"} />;
}
