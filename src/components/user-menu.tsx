"use client";

import { LogOut } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function UserMenu() {
  const { enabled, email, label, isAdmin, signOut } = useAuth();
  const shown = label || email;
  return (
    <Popover>
      <PopoverTrigger
        aria-label={`Account menu for ${shown}`}
        title={shown}
        className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground uppercase outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
      >
        {shown.charAt(0)}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 gap-1 p-2">
        <div className="px-2 py-1.5">
          <p className="text-xs text-muted-foreground">Signed in as</p>
          <p className="truncate text-sm font-medium" title={shown}>
            {shown}
          </p>
          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${isAdmin ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{isAdmin ? "Admin" : "Staff"}</span>
        </div>
        <div className="my-1 h-px bg-border" />
        <button
          type="button"
          onClick={() => void signOut()}
          className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
        >
          <LogOut className="size-4" />
          {enabled ? "Sign out" : "Reset session"}
        </button>
      </PopoverContent>
    </Popover>
  );
}
