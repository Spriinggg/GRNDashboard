"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { FieldSelect, type SelectOption } from "@/components/filter-select";
import { cn } from "@/lib/utils";

const modes = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

const subscribe = () => () => {};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // The saved theme is only known in the browser, so render nothing selected on the server.
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);

  return (
    <div role="radiogroup" aria-label="Colour mode" className="inline-flex min-h-10 items-center gap-0.5 rounded-[10px] border bg-card p-1">
      {modes.map(({ value, label, icon: Icon }) => {
        const active = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              "grid size-8 place-items-center rounded-md text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
              active && "bg-primary text-primary-foreground hover:text-primary-foreground",
            )}
          >
            <Icon className="size-4" />
          </button>
        );
      })}
    </div>
  );
}

type Mode = (typeof modes)[number]["value"];
const modeOptions: SelectOption<Mode>[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System (follow my device)" },
];

// The same choice as ThemeToggle, as a dropdown for the Profile page. The top bar keeps the three small buttons.
export function ThemeSelect() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const value: Mode = mounted && (theme === "light" || theme === "dark") ? theme : "system";
  return <FieldSelect ariaLabel="Colour mode" value={value} options={modeOptions} onChange={setTheme} className="w-full max-w-xs" />;
}
