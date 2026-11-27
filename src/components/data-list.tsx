"use client";

import { useAuth } from "@/components/auth-provider";
import { useData } from "@/components/data-provider";
import { Button } from "@/components/ui/button";
import { dKey } from "@/lib/calc";

const fmtTs = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(+d) ? "" : d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

// Every saved outlet-day. Admins delete directly; staff can only ask, and an admin approves.
export function DataList() {
  const { store, requests, deleteDay, requestDelete } = useData();
  const { isAdmin } = useAuth();
  const pending = new Set(requests.map((r) => r.dataset_id));
  const keys = Object.keys(store)
    .filter((k) => store[k].items?.length)
    .sort((a, b) => (store[a].outlet === store[b].outlet ? dKey(store[a].date) - dKey(store[b].date) : store[a].outlet < store[b].outlet ? -1 : 1));
  if (!keys.length) return <p className="text-sm text-muted-foreground">No data saved yet.</p>;
  return (
    <ul className="divide-y rounded-xl bg-card ring-1 ring-foreground/10">
      {keys.map((k) => {
        const d = store[k];
        const by = d.upBy ? `Uploaded by ${d.upBy}${d.upAt ? " · " + fmtTs(d.upAt) : ""}` : d.upAt ? `Uploaded ${fmtTs(d.upAt)}` : "";
        return (
          <li key={k} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0 text-sm">
              <p className="font-medium">
                {d.outlet} <span className="font-normal text-muted-foreground">{d.date}</span>
              </p>
              {by ? <p className="text-xs text-muted-foreground">{by}</p> : null}
              {d.files?.length ? <p className="mt-1 text-xs break-all text-muted-foreground">{d.files.join(" · ")}</p> : null}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">{d.items!.length} items</span>
              {isAdmin ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (confirm(`Delete ${d.outlet} · ${d.date} for everyone? This cannot be undone.`)) void deleteDay(k);
                  }}
                >
                  Delete
                </Button>
              ) : pending.has(k) ? (
                <span className="text-xs font-medium text-muted-foreground">Delete requested</span>
              ) : (
                <Button variant="outline" size="sm" onClick={() => void requestDelete(k)}>
                  Request delete
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
