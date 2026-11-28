"use client";

import { useSyncExternalStore } from "react";

// One tick per second, shared by every clock on the page.
let nowMs = 0;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function subscribeNow(cb: () => void) {
  listeners.add(cb);
  if (listeners.size === 1) {
    const tick = () => {
      nowMs = Date.now();
      listeners.forEach((l) => l());
    };
    tick();
    timer = setInterval(tick, 1000);
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0) clearInterval(timer);
  };
}

// 0 until the page is in the browser, so the server and the first paint agree.
export function useNow(): number {
  return useSyncExternalStore(subscribeNow, () => nowMs, () => 0);
}

const two = (n: number) => String(n).padStart(2, "0");

function Digit({ ch, live }: { ch: string; live?: boolean }) {
  return (
    <span className="grid h-12 w-9 place-items-center overflow-hidden rounded-lg border bg-card text-3xl font-semibold shadow-sm tabular-nums">
      {/* A new key restarts the animation, so a digit drops in each time it changes */}
      <span key={ch} className={live ? "tick" : undefined}>
        {ch}
      </span>
    </span>
  );
}

export function LiveClock() {
  const now = useNow();
  const d = now === 0 ? null : new Date(now);
  const hh = d ? two(d.getHours()) : "--";
  const mm = d ? two(d.getMinutes()) : "--";
  const ss = d ? two(d.getSeconds()) : "--";
  const date = d ? new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(d) : "";
  return (
    <div className="flex flex-col items-start gap-1.5 md:items-end" role="timer" aria-label={d ? `${hh}:${mm}:${ss}, ${date}` : "Clock"}>
      <div className="flex items-center gap-1" aria-hidden>
        <Digit ch={hh[0]} />
        <Digit ch={hh[1]} />
        <span className="px-0.5 text-2xl font-semibold text-muted-foreground">:</span>
        <Digit ch={mm[0]} />
        <Digit ch={mm[1]} />
        <span className="px-0.5 text-2xl font-semibold text-muted-foreground">:</span>
        <Digit ch={ss[0]} live />
        <Digit ch={ss[1]} live />
      </div>
      <p className="text-sm text-muted-foreground">{date || " "}</p>
    </div>
  );
}
