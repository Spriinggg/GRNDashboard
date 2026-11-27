"use client";

import { useData } from "@/components/data-provider";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { grnCheck } from "@/lib/calc";
import { cn } from "@/lib/utils";

// Each delivered item on a GRN, matched to the receiving the system recorded under the same GRN number.
export function GrnCrossCheck() {
  const { cur: d } = useData();
  const checks = grnCheck(d);
  const note = (t: string) => <Card className="p-5 text-sm text-muted-foreground">{t}</Card>;
  return (
    <section aria-labelledby="grn-check" className="space-y-3">
      <div>
        <h2 id="grn-check" className="font-display text-xl font-bold">
          GRN cross-check{d ? `, ${d.outlet} ${d.date}` : ""}
        </h2>
        <p className="text-sm text-muted-foreground">Each delivered item on the GRN, matched to the system’s recorded receiving by GRN number.</p>
      </div>
      {!d || !checks
        ? note("No GRN uploaded for this day. Upload the GRN PDF(s) on the Upload page to cross-check what was delivered against what the system recorded.")
        : !d.mv
          ? note("GRN loaded. Upload this day’s Stock Movement to run the cross-check.")
          : checks.map((g) => (
              <Card key={g.no} className="gap-0 overflow-hidden py-0 shadow-sm">
                <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
                  <h3 className="font-semibold">GRN {g.no}</h3>
                  <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", g.miss ? "bg-danger-soft text-danger" : "bg-success-soft text-success")}>
                    {g.rec}/{g.total} recorded{g.miss ? ` · ${g.miss} missing` : ""}
                  </span>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">GRN qty</TableHead>
                      <TableHead className="text-right">System IN</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {g.items.map((it) => (
                      <TableRow key={it.code}>
                        <TableCell>
                          <div className="font-medium">{it.code}</div>
                          <div className="text-xs text-muted-foreground">{(it.desc || "").slice(0, 36)}</div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {it.qty} {it.uom}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{it.status === "miss" ? "—" : `${it.inq} ${it.inuom}`}</TableCell>
                        <TableCell>
                          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", it.status === "miss" ? "bg-danger-soft text-danger" : "bg-success-soft text-success")}>
                            {it.status === "miss" ? "NOT recorded" : it.status === "exact" ? "recorded" : "recorded (converted)"}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            ))}
    </section>
  );
}
