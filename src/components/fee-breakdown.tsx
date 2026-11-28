// Fee types in the order the platforms list them (used by the derivation on the Sales pages and the Profit & loss page). One hue in different strengths keeps the page calm. The same colours
// are used in the rate bars and in the steps of the waterfall, so a colour means the same fee everywhere.
export const FEE_PARTS = [
  { key: "commission", label: "Commission", short: "Commission", color: "var(--primary)", opacity: 1 },
  { key: "ads", label: "Advertising", short: "Advertising", color: "var(--primary)", opacity: 0.55 },
  { key: "service", label: "Platform / service fee", short: "Service fee", color: "var(--muted-foreground)", opacity: 0.6 },
  { key: "gateway", label: "Payment gateway", short: "Gateway", color: "var(--muted-foreground)", opacity: 0.35 },
  { key: "adjust", label: "Adjustments / credits", short: "Adjustments", color: "var(--foreground)", opacity: 0.3 },
] as const;
