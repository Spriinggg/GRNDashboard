"use client";

import { FilterSelect } from "@/components/filter-select";
import { LiveClock } from "@/components/live-clock";
import { useData } from "@/components/data-provider";
import { datesFor, fmtD, outletsOf } from "@/lib/calc";

// Title, one sentence and the same big digital clock on every page.
export function PageHeader({ title, subtitle }: { title: string; subtitle: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-3xl leading-tight font-bold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <LiveClock />
    </header>
  );
}

// The outlet and the day every figure on the page is about.
export function ScopeBar() {
  const { store, curO, curD, setOutlet, setDate } = useData();
  const os = outletsOf(store);
  const names = Object.keys(os);
  const dts = curO ? datesFor(store, curO).slice().reverse() : [];
  return (
    <div className="flex min-w-0 items-center gap-1.5" role="group" aria-label="Outlet and day">
      <FilterSelect
        boxed
        label="Outlet"
        value={curO ?? ""}
        onChange={setOutlet}
        options={names.length ? names.map((ok) => ({ value: ok, label: os[ok].name, meta: `${os[ok].dates.length}d` })) : [{ value: "", label: "No outlets loaded" }]}
      />
      <FilterSelect boxed label="Day" value={curD ?? ""} onChange={setDate} options={dts.length ? dts.map((d) => ({ value: d, label: fmtD(d) })) : [{ value: "", label: "No days" }]} />
    </div>
  );
}
