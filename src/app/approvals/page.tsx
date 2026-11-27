"use client";

import { useAuth } from "@/components/auth-provider";
import { useData } from "@/components/data-provider";
import { PageHeader } from "@/components/page-header";
import { EmptyNote } from "@/components/stat-card";
import { Button } from "@/components/ui/button";

export default function Approvals() {
  const { isAdmin } = useAuth();
  const { requests, deleteDay, rejectRequest } = useData();
  return (
    <>
      <PageHeader title="Approvals" subtitle="Delete requests from staff. Nothing is removed until an admin approves." />
      {!isAdmin ? (
        <EmptyNote>Only admins can review delete requests.</EmptyNote>
      ) : !requests.length ? (
        <EmptyNote>No pending requests.</EmptyNote>
      ) : (
        <ul className="divide-y rounded-xl bg-card ring-1 ring-foreground/10">
          {requests.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="text-sm">
                <p className="font-medium">
                  {r.outlet || ""} <span className="font-normal text-muted-foreground">{r.date || ""}</span>
                </p>
                <p className="text-xs text-muted-foreground">Requested by {r.requester_email || "—"}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => void deleteDay(r.dataset_id)}>
                  Approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => void rejectRequest(r.id)}>
                  Reject
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
