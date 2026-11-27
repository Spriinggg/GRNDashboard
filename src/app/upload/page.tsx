"use client";

import { Upload as UploadIcon } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { DataList } from "@/components/data-list";
import { useData } from "@/components/data-provider";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { outletsOf } from "@/lib/calc";
import type { Kind } from "@/lib/types";
import { cn } from "@/lib/utils";

const ZONES: { kind: Kind; title: string; hint: string; accept: string }[] = [
  { kind: "sales", title: "Sales, POS (Zeoniq)", hint: "Product Sales Listing, .xlsx", accept: ".xlsx,.xls" },
  { kind: "stockcount", title: "Stock count, AM and PM", hint: "Stock Count Raw Materials, .xlsx", accept: ".xlsx,.xls" },
  { kind: "movement", title: "Stock movement, Codemax", hint: "Movement Details Raw Materials, .xlsx", accept: ".xlsx,.xls" },
  { kind: "grn", title: "GRN, goods received", hint: "Goods Received Note, .pdf", accept: ".pdf" },
  { kind: "checklist", title: "Treeams, checklist", hint: "Checklist Reports, .xlsx", accept: ".xlsx,.xls" },
  { kind: "channels", title: "Sales, app / channels", hint: "App order export, .xlsx or .csv", accept: ".csv,.xlsx,.xls" },
];
const STEPS = [
  ["Sales, POS (Zeoniq)", "Product Sales Listing. Sets the ideal (recipe) usage."],
  ["Stock count, AM and PM", "Stock Count Raw Materials. The physical stock on the shelf."],
  ["Stock movement, Codemax", "Movement Details Raw Materials. IN (received) and OUT (sales) per item."],
  ["GRN, goods received", "The day's delivery notes, to check what arrived against the system."],
];

export default function Upload() {
  const { store, fileNames, handleFiles, loadSample, clearAll, status } = useData();
  const { isAdmin } = useAuth();
  const [over, setOver] = useState<Kind | null>(null);
  const nD = Object.keys(store).length;
  const nO = Object.keys(outletsOf(store)).length;
  const clear = () => {
    if (confirm("Clear all loaded data, including the saved cloud copy? This cannot be undone.")) void clearAll();
  };
  return (
    <>
      <PageHeader title="Upload data" subtitle="One outlet, one day at a time. The page detects each file type, joins them and works out the variance." />
      <div role="status" aria-live="polite" className="min-h-5 text-sm text-muted-foreground">
        {status || (nD ? `${nO} outlet(s), ${nD} outlet-day(s) loaded. Parsed in your browser and saved to your cloud.` : "Nothing loaded yet. Everything is parsed in your browser and saved to your cloud. No file leaves your machine.")}
      </div>

      <Card className="gap-4 p-6 shadow-sm">
        <div>
          <h2 className="text-base font-semibold">What to upload</h2>
          <p className="text-sm text-muted-foreground">The first four, for the same outlet and date. Treeams and app orders are optional extras. Upload a week of files to build the history.</p>
        </div>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s[0]} className="flex items-start gap-3">
              <span aria-hidden className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {i + 1}
              </span>
              <div className="leading-tight">
                <p className="text-sm font-medium">{s[0]}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{s[1]}</p>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ZONES.map((z) => {
          const has = fileNames[z.kind].length > 0;
          return (
            <label
              key={z.kind}
              className={cn(
                "relative flex cursor-pointer flex-col gap-1 rounded-xl border-2 border-dashed bg-card p-5 shadow-sm transition-colors focus-within:ring-2 focus-within:ring-ring hover:border-primary hover:bg-primary/5",
                has && "border-solid border-success",
                over === z.kind && "border-primary bg-primary/5",
              )}
              onDragEnter={(e) => {
                e.preventDefault();
                setOver(z.kind);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(z.kind);
              }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const f = [...e.dataTransfer.files];
                if (f.length) void handleFiles(f);
              }}
            >
              <input
                type="file"
                multiple
                accept={z.accept}
                className="absolute inset-0 size-full cursor-pointer opacity-0"
                onChange={(e) => {
                  const f = [...(e.target.files || [])];
                  if (f.length) void handleFiles(f);
                  e.target.value = "";
                }}
              />
              <UploadIcon aria-hidden className="mb-1 size-6 text-primary" />
              <b className="text-sm font-semibold">{z.title}</b>
              <span className="text-xs text-muted-foreground">{z.hint}</span>
              <div className="mt-2 text-xs font-medium break-all text-success">
                {fileNames[z.kind].map((n) => (
                  <div key={n}>&#10003; {n}</div>
                ))}
              </div>
            </label>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={loadSample}>
          Load sample day (Ampang)
        </Button>
        {isAdmin ? (
          <Button variant="outline" onClick={clear}>
            Clear all data
          </Button>
        ) : null}
      </div>

      <section aria-labelledby="saved-days" className="space-y-3">
        <div>
          <h2 id="saved-days" className="font-display text-xl font-bold">
            Data for each day
          </h2>
          <p className="text-sm text-muted-foreground">{isAdmin ? "As an admin you can delete a day directly." : "Staff can request a delete; an admin approves before anything is removed."}</p>
        </div>
        <DataList />
      </section>
    </>
  );
}
