"use client";

import { useData } from "@/components/data-provider";
import { cn } from "@/lib/utils";

// The Supabase mark. It takes the colour of the text around it: Supabase green when connected, grey on this computer only.
function SupabaseMark({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 109 113" className={className}>
      <path fill="currentColor" d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9813 107.314L53.9738 40.0627L99.1935 40.0627C107.384 40.0627 111.952 49.5228 106.859 55.9374L63.7076 110.284Z" />
      <path fill="currentColor" fillOpacity={0.7} d="M45.317 2.07103C48.1765 -1.53037 53.9745 0.442937 54.0434 5.041L54.4849 72.2922H9.83113C1.64038 72.2922 -2.92775 62.8321 2.1655 56.4175L45.317 2.07103Z" />
    </svg>
  );
}

const WORD = { off: "Local", synced: "Synced", saved: "Saved", loading: "Syncing", error: "Error" } as const;
const FULL = {
  off: "Working on this computer only, not connected to Supabase",
  synced: "Supabase: data is in sync",
  saved: "Supabase: your changes were saved",
  loading: "Supabase: loading the latest data",
  error: "Supabase: could not sync. Check the connection or the permissions",
} as const;

// The cloud state as one small pill: the Supabase mark and one word. On a phone only the mark shows, with the words kept for
// screen readers and the tooltip.
export function CloudStatus() {
  const { cloud } = useData();
  return (
    <span role="status" title={FULL[cloud]} className="inline-flex h-7 items-center gap-1.5 rounded-full border bg-card px-2 text-xs font-medium">
      <SupabaseMark className={cn("size-3.5 shrink-0", cloud === "off" ? "text-muted-foreground" : "text-[#3ecf8e]", cloud === "loading" && "motion-safe:animate-pulse")} />
      <span className={cn("hidden sm:inline", cloud === "error" ? "text-danger" : cloud === "off" ? "text-muted-foreground" : "text-foreground")}>{WORD[cloud]}</span>
      <span className="sr-only sm:hidden">{FULL[cloud]}</span>
    </span>
  );
}
