import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function Stat({ label, value, sub, className }: { label: string; value: React.ReactNode; sub?: React.ReactNode; className?: string }) {
  return (
    <Card className={cn("gap-1 p-5 shadow-sm", className)}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-2xl leading-tight font-semibold tabular-nums">{value}</p>
      {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
    </Card>
  );
}

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return <Card className="p-5 text-sm text-muted-foreground">{children}</Card>;
}
