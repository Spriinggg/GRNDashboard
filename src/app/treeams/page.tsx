"use client";

import { useMemo } from "react";
import { useData } from "@/components/data-provider";
import { PageHeader } from "@/components/page-header";
import { EmptyNote, Stat } from "@/components/stat-card";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const PREF = ["Opening", "Closing", "Manager", "Cash"];
const pct = (v: number | null) => (v == null ? "—" : Math.round(v) + "%");
const tone = (v: number | null) => (v == null ? "text-muted-foreground" : v >= 80 ? "text-success" : v >= 50 ? "text-foreground" : "text-danger");

export default function Treeams() {
  const { checklist } = useData();
  const m = useMemo(() => {
    const outs = Object.keys(checklist);
    const types: string[] = [];
    outs.forEach((o) => Object.keys(checklist[o]).forEach((t) => !types.includes(t) && types.push(t)));
    types.sort((a, b) => (PREF.indexOf(a) < 0 ? 99 : PREF.indexOf(a)) - (PREF.indexOf(b) < 0 ? 99 : PREF.indexOf(b)));
    let gd = 0,
      ge = 0;
    const rows = outs.map((o) => {
      let d = 0,
        e = 0;
      const per: Record<string, number | null> = {};
      types.forEach((t) => {
        const x = checklist[o][t];
        per[t] = x ? (x.exp ? (x.done / x.exp) * 100 : 0) : null;
        if (x) {
          d += x.done;
          e += x.exp;
        }
      });
      gd += d;
      ge += e;
      return { o, per, overall: e ? (d / e) * 100 : 0 };
    });
    rows.sort((a, b) => a.overall - b.overall);
    return { types, rows, gd, ge, overall: ge ? (gd / ge) * 100 : 0 };
  }, [checklist]);
  const best = m.rows[m.rows.length - 1];
  const worst = m.rows[0];
  return (
    <>
      <PageHeader title="Treeams checklists" subtitle="Did each outlet complete its daily operational checklists? Higher is better." />
      {!m.rows.length ? (
        <EmptyNote>Upload the Treeams checklist report (.xlsx) on the Upload page.</EmptyNote>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Overall compliance" value={Math.round(m.overall) + "%"} sub={`${m.gd} of ${m.ge} done`} />
            <Stat label="Outlets tracked" value={m.rows.length} sub="from Treeams" />
            <Stat label="Best" value={best.o} sub={Math.round(best.overall) + "%"} />
            <Stat label="Needs attention" value={worst.o} sub={Math.round(worst.overall) + "%"} />
          </div>
          <Card className="gap-0 overflow-hidden py-0 shadow-sm">
            <div className="border-b px-4 py-3 text-sm font-semibold">By outlet, lowest compliance first</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Outlet</TableHead>
                  {m.types.map((t) => (
                    <TableHead key={t} className="text-right">
                      {t}
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Overall</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {m.rows.map((r) => (
                  <TableRow key={r.o}>
                    <TableCell className="font-medium">{r.o}</TableCell>
                    {m.types.map((t) => (
                      <TableCell key={t} className={`text-right font-semibold tabular-nums ${tone(r.per[t])}`}>
                        {pct(r.per[t])}
                      </TableCell>
                    ))}
                    <TableCell className={`text-right font-bold tabular-nums ${tone(r.overall)}`}>{pct(r.overall)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </>
  );
}
