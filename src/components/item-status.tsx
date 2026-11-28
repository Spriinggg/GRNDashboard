import { AlertTriangle, CircleAlert, CircleCheck, Info } from "lucide-react";
import type { Item, StatusCode } from "@/lib/types";
import { cap, statusOf } from "@/lib/calc";
import { StatusIndicator, type Tone } from "@/components/status-indicator";
import { Tip } from "@/components/tip";

const look: Record<StatusCode, { icon: typeof Info; tone: Tone }> = {
  crit: { icon: AlertTriangle, tone: "danger" },
  warn: { icon: CircleAlert, tone: "warning" },
  good: { icon: CircleCheck, tone: "success" },
  info: { icon: Info, tone: "info" },
};

// One status for an item. The icon is drawn only for a warning or danger status (see status-indicator.tsx).
export function ItemStatus({ item }: { item: Item }) {
  const [c, t] = statusOf(item);
  return (
    <StatusIndicator icon={look[c].icon} tone={look[c].tone}>
      {cap(t)}
    </StatusIndicator>
  );
}

// A yes or no check with a word: calm green when done, a warning icon when missing. `tip` explains it on hover.
export function CheckStatus({ ok, yes, no, tip }: { ok: boolean; yes: string; no: string; tip?: string }) {
  const el = ok ? (
    <StatusIndicator icon={CircleCheck} tone="success">
      {yes}
    </StatusIndicator>
  ) : (
    <StatusIndicator icon={CircleAlert} tone="warning">
      {no}
    </StatusIndicator>
  );
  return tip ? <Tip text={tip}>{el}</Tip> : el;
}
