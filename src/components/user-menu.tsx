"use client";

import { Check, LogOut, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { useAuth } from "@/components/auth-provider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const MODES = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
] as const;

const subscribe = () => () => {};

// The account menu: who is signed in, the colour theme (System, Light or Dark) and sign out.
export function UserMenu() {
  const { enabled, email, label, isAdmin, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  // The saved theme is only known in the browser, so nothing is shown as chosen on the server.
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const current = mounted ? (theme ?? "system") : "";
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
        <div role="radiogroup" aria-label="Theme" className="flex flex-col">
          <p className="px-2 pt-1 pb-1 text-xs text-muted-foreground">Theme</p>
          {MODES.map(({ value, label: text, icon: Icon }) => {
            const on = current === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setTheme(value)}
                className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring", on && "font-medium")}
              >
                <Icon aria-hidden className="size-4 text-muted-foreground" />
                {text}
                {on ? <Check aria-hidden className="ml-auto size-4 text-primary" /> : null}
              </button>
            );
          })}
        </div>
        <div className="my-1 h-px bg-border" />
        <button
          type="button"
          onClick={() => void signOut()}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
        >
          <LogOut aria-hidden className="size-4 text-muted-foreground" />
          {enabled ? "Sign out" : "Reset session"}
        </button>
      </PopoverContent>
    </Popover>
  );
}
