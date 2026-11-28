"use client";

import { useData } from "@/components/data-provider";
import { ItemStatus } from "@/components/item-status";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { RM2, cap, signTone } from "@/lib/calc";
import { cn } from "@/lib/utils";

// The detail panel of one item. Opens from the right, 42 rem wide, full width on a phone.
export function ItemSheet() {
  const { cur, openCode, setOpenCode } = useData();
  const it = openCode && cur?.items ? (cur.items.find((i) => i.code === openCode) ?? null) : null;
  return (
    <Sheet open={it !== null} onOpenChange={(o) => !o && setOpenCode(null)}>
      <SheetContent className="w-full gap-0 overflow-y-auto">{it && cur ? <Detail key={it.code} /> : null}</SheetContent>
    </Sheet>
  );
}

function Detail() {
  const { cur, openCode } = useData();
  const it = cur!.items!.find((i) => i.code === openCode)!;
  const m = cur!.mv ? cur!.mv[it.code] : undefined;
  const mx = Math.max(it.sys, it.phys, 1);
  const short = it.varrm <= -10;
  const off = it.sys ? Math.round((it.varq / it.sys) * 100) : 0;
  return (
    <>
      <SheetHeader className="border-b pr-12">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="font-bold">{it.code}</span>
          <ItemStatus item={it} />
        </div>
        <SheetTitle className="font-display text-2xl font-bold">{it.name}</SheetTitle>
        <SheetDescription>
          {cap(it.cat.toLowerCase())} &middot; value at risk {RM2(it.varrm)} &middot; {off}% off the system
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-col gap-6 p-4">
        <section aria-label="Expected against counted">
          <h3 className="mb-3 text-base font-semibold">Expected against counted</h3>
          <div role="img" aria-label={`Expected ${it.sys} ${it.uom}, counted ${it.phys} ${it.uom}`} className="flex flex-col gap-3">
            <div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Expected close (system)</span>
                <b className="tabular-nums">
                  {it.sys} {it.uom}
                </b>
              </div>
              <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-muted">
                <i className="block h-full rounded-full bg-muted-foreground/40" style={{ width: `${(it.sys / mx) * 100}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Counted close (physical)</span>
                <b className="tabular-nums">
                  {it.phys} {it.uom}
                </b>
              </div>
              <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-muted">
                <i className={cn("block h-full rounded-full", short ? "bg-danger" : "bg-primary")} style={{ width: `${(it.phys / mx) * 100}%` }} />
              </div>
            </div>
          </div>
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <i aria-hidden className="inline-block size-2.5 rounded-[3px] bg-muted-foreground/40" /> Expected by the system
            </span>
            <span className="flex items-center gap-1.5">
              <i aria-hidden className={cn("inline-block size-2.5 rounded-[3px]", short ? "bg-danger" : "bg-primary")} /> Counted on the shelf
            </span>
          </p>
          <dl className="mt-4 divide-y rounded-lg border text-sm">
            <div className="flex justify-between px-3 py-2.5">
              <dt className="text-muted-foreground">Variance</dt>
              <dd className="font-semibold tabular-nums">
                {it.varq} {it.uom}
              </dd>
            </div>
            <div className="flex justify-between px-3 py-2.5">
              <dt className="text-muted-foreground">Value</dt>
              <dd className={cn("font-semibold tabular-nums", signTone(it.varrm))}>{RM2(it.varrm)}</dd>
            </div>
          </dl>
        </section>

        <section aria-label="Movement this day">
          <h3 className="mb-3 text-base font-semibold">Movement this day</h3>
          {m ? (
            <>
              <dl className="divide-y rounded-lg border text-sm">
                <div className="flex justify-between px-3 py-2.5">
                  <dt className="text-muted-foreground">Received (IN)</dt>
                  <dd className="font-semibold tabular-nums">
                    {+m.in.toFixed(2)} {it.uom}
                  </dd>
                </div>
                <div className="flex justify-between px-3 py-2.5">
                  <dt className="text-muted-foreground">Sales deducted (ideal use)</dt>
                  <dd className="font-semibold tabular-nums">
                    {+m.outPos.toFixed(2)} {it.uom}
                  </dd>
                </div>
              </dl>
              {m.events.length > 0 ? (
                <ol className="mt-3 divide-y text-sm">
                  {m.events.map((e, i) => (
                    <li key={i} className="grid grid-cols-[5rem_6rem_1fr] gap-3 py-2.5">
                      <time className="text-xs text-muted-foreground">{e.t}</time>
                      <b className={cn("tabular-nums", e.in > 0 ? "text-success" : e.out > 0 ? "text-foreground" : "")}>
                        {e.in > 0 ? "+" + e.in : e.out > 0 ? "−" + e.out : ""} {it.uom}
                      </b>
                      <span className="text-xs text-muted-foreground">{e.r}</span>
                    </li>
                  ))}
                </ol>
              ) : null}
              <p className="mt-4 max-w-[70ch] rounded-lg bg-muted p-3 text-sm">
                Received <b>{+m.in.toFixed(1)}</b>, sales deducted <b>{+m.outPos.toFixed(1)}</b> {it.uom}. The count then forced a{" "}
                <b>
                  {it.varq} {it.uom}
                </b>{" "}
                adjustment, the part not explained by recorded sales or receiving. Check delivery against physical use.
              </p>
            </>
          ) : (
            <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              Upload the Stock Movement file for this day to see this item&apos;s IN and OUT timeline and the receiving behind it.
            </p>
          )}
        </section>
      </div>
    </>
  );
}
