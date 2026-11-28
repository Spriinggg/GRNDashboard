import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type Tone = "success" | "warning" | "danger" | "info" | "muted";

// Yellow is too light to read as text on a white card, so a warning keeps the normal text colour and only
// its icon is yellow. The word still says what it is. Red, green and blue are dark enough to read as text.
const toneClass: Record<Tone, string> = {
  success: "text-success",
  warning: "text-foreground",
  danger: "text-danger",
  info: "text-primary",
  muted: "text-muted-foreground",
};
const iconClass: Partial<Record<Tone, string>> = { warning: "text-warning" };

// A status shown as plain text, without a pill. The words always stay, so colour is never the only way to
// tell the states apart. Only a status that needs attention (warning or danger) also gets an icon, at the
// right of the words. Normal statuses (done, in progress, closed) are coloured text only, so when every row
// has an icon the icon stops meaning anything. Pass `icon` always, it is simply not drawn for calm tones.
const ICON_TONES: Tone[] = ["warning", "danger"];
export function StatusIndicator({
  icon: Icon,
  tone,
  children,
  className,
}: {
  icon: LucideIcon;
  tone: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm font-medium whitespace-nowrap", toneClass[tone], className)}>
      {children}
      {ICON_TONES.includes(tone) ? <Icon aria-hidden className={cn("size-4 shrink-0", iconClass[tone])} strokeWidth={2.25} /> : null}
    </span>
  );
}
