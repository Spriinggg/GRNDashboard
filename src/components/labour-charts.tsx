"use client";

import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, LabelList, Line, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import { fmtFull, fmtShort } from "@/components/drill-chart";
import type { DayPoint, HourPoint, WeekdayPoint } from "@/lib/labour-mock";
import { TARGET } from "@/lib/labour-mock";

const axis = { fontSize: 12, fill: "var(--muted-foreground)" } as const;
const box = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 } as const;
const rmk = (v: number) => fmtShort("sales", v).replace("RM ", "");
const line = (k: string, v: string) => (
  <p key={k} className="flex justify-between gap-6 tabular-nums">
    <span className="text-muted-foreground">{k}</span>
    <b className="font-semibold">{v}</b>
  </p>
);

export type LabourRow = { key: string; name: string; sub?: string; pct: number; selected: boolean; tip: [string, string][] };

// Labour as a share of net sales for the outlets, highest first, against the target. Over the target is red and within it is
// grey, so red marks only the ones to look at. Select a bar to look at that outlet, and select it again to let go.
export function LabourBars({ rows, hasSelection, onPick, label }: { rows: LabourRow[]; hasSelection: boolean; onPick: (key: string) => void; label: string }) {
  if (!rows.length) return <p className="py-10 text-center text-sm text-muted-foreground">No outlet to show for this choice.</p>;
  const max = Math.max(...rows.map((r) => r.pct), TARGET) * 1.02;
  const pick = (d: unknown) => {
    const p = d as { payload?: LabourRow; key?: string };
    const k = p.payload?.key ?? p.key;
    if (k) onPick(k);
  };
  return (
    <div role="img" aria-label={label} style={{ height: rows.length * 34 + 28 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 16, right: 64, bottom: 2, left: 0 }} barCategoryGap={8}>
          <CartesianGrid horizontal={false} stroke="var(--border)" />
          <XAxis type="number" hide domain={[0, max]} />
          <YAxis type="category" dataKey="name" width={150} tickLine={false} axisLine={false} interval={0} tick={{ ...axis, fill: "var(--foreground)" }} tickFormatter={(v: string) => (v.length > 22 ? v.slice(0, 21) + "…" : v)} />
          <ReferenceLine x={TARGET} stroke="var(--muted-foreground)" strokeDasharray="6 5" label={{ value: `Target ${TARGET}%`, position: "top", fill: "var(--muted-foreground)", fontSize: 11 }} />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            content={(p) => {
              const { active, payload } = p as unknown as { active?: boolean; payload?: { payload: LabourRow }[] };
              const r = active && payload?.[0]?.payload;
              if (!r) return null;
              return (
                <div style={box} className="min-w-52 px-3 py-2.5 shadow-sm">
                  <p className="font-semibold">{r.name}</p>
                  {r.sub ? <p className="mb-1 text-muted-foreground">{r.sub}</p> : <div className="mb-1" />}
                  {r.tip.map(([k, v]) => line(k, v))}
                  <p className="mt-1.5 text-primary">{r.selected ? "Click to show every outlet" : "Click to look at this outlet"}</p>
                </div>
              );
            }}
          />
          <Bar dataKey="pct" radius={4} maxBarSize={22} isAnimationActive={false} cursor="pointer" onClick={pick}>
            {rows.map((r) => (
              <Cell key={r.key} fill={r.pct > TARGET ? "var(--primary)" : "var(--muted-foreground)"} fillOpacity={hasSelection && !r.selected ? 0.25 : r.pct > TARGET ? 0.9 : 0.6} />
            ))}
            <LabelList dataKey="pct" position="right" formatter={(v) => `${Number(v).toFixed(1)}%`} style={{ fontSize: 12, fontWeight: 600, fill: "var(--foreground)" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export type LabourDot = { name: string; area: string; sales: number; pct: number; cost: number; over: boolean };

// Every outlet as a dot: net sales across, labour share up, the target as a dashed line. High and to the left is a small outlet
// whose crew costs a lot for what it sells. Click a dot to open that outlet.
export function LabourScatter({ dots, onPick, label }: { dots: LabourDot[]; onPick: (name: string) => void; label: string }) {
  return (
    <div role="img" aria-label={label} className="h-[360px]">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 12, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid stroke="var(--border)" />
          <XAxis type="number" dataKey="sales" name="Net sales" tick={axis} tickLine={false} axisLine={{ stroke: "var(--border)" }} tickFormatter={(v) => rmk(Number(v))} domain={["dataMin - 5000", "dataMax + 5000"]} />
          <YAxis type="number" dataKey="pct" name="Labour" tick={axis} tickLine={false} axisLine={false} width={44} tickFormatter={(v) => `${Number(v).toFixed(0)}%`} domain={["dataMin - 1", "dataMax + 1"]} />
          <ReferenceLine y={TARGET} stroke="var(--muted-foreground)" strokeDasharray="6 5" />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            content={(p) => {
              const { active, payload } = p as unknown as { active?: boolean; payload?: { payload: LabourDot }[] };
              const d = active && payload?.[0]?.payload;
              if (!d) return null;
              return (
                <div style={box} className="min-w-52 px-3 py-2.5 shadow-sm">
                  <p className="font-semibold">{d.name}</p>
                  <p className="mb-1 text-muted-foreground">{d.area}</p>
                  {line("Net sales", fmtFull("sales", d.sales))}
                  {line("Labour cost", fmtFull("sales", d.cost))}
                  {line("Labour share", `${d.pct.toFixed(1)}%`)}
                  <p className="mt-1.5 text-primary">Click to open</p>
                </div>
              );
            }}
          />
          <Scatter data={dots} isAnimationActive={false} cursor="pointer" onClick={(d) => onPick(((d as unknown as { payload?: LabourDot; name?: string }).payload?.name ?? (d as unknown as LabourDot).name) as string)}>
            {dots.map((d) => (
              <Cell key={d.name} fill={d.over ? "var(--primary)" : "var(--muted-foreground)"} fillOpacity={d.over ? 0.95 : 0.55} stroke="var(--card)" />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

// What labour cost each day as columns, and that as a share of the day's sales as a line against the target.
export function LabourTrend({ data, label }: { data: DayPoint[]; label: string }) {
  const hi = Math.max(...data.map((d) => d.pct), TARGET) + 2;
  const lo = Math.max(0, Math.min(...data.map((d) => d.pct), TARGET) - 4);
  return (
    <div role="img" aria-label={label} className="h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={{ stroke: "var(--border)" }} interval={data.length > 12 ? Math.ceil(data.length / 10) - 1 : 0} />
          <YAxis yAxisId="rm" tick={axis} tickLine={false} axisLine={false} width={52} tickFormatter={(v) => rmk(Number(v))} />
          <YAxis yAxisId="pct" orientation="right" domain={[Math.floor(lo), Math.ceil(hi)]} tick={axis} tickLine={false} axisLine={false} width={44} tickFormatter={(v) => `${v}%`} />
          <ReferenceLine yAxisId="pct" y={TARGET} stroke="var(--muted-foreground)" strokeDasharray="6 5" />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            content={(p) => {
              const { active, payload } = p as unknown as { active?: boolean; payload?: { payload: DayPoint }[] };
              const d = active && payload?.[0]?.payload;
              if (!d) return null;
              return (
                <div style={box} className="min-w-52 px-3 py-2.5 shadow-sm">
                  <p className="mb-1 font-semibold">{d.label} <span className="font-normal text-muted-foreground">{d.sub}</span></p>
                  {line("Labour cost", fmtFull("sales", d.cost))}
                  {line("Net sales", fmtFull("sales", d.sales))}
                  {line("Labour share", `${d.pct.toFixed(1)}%`)}
                  {line("Hours worked", Math.round(d.hours).toLocaleString("en"))}
                </div>
              );
            }}
          />
          <Bar yAxisId="rm" dataKey="cost" fill="var(--muted-foreground)" fillOpacity={0.55} radius={[4, 4, 0, 0]} maxBarSize={30} isAnimationActive={false} />
          <Line yAxisId="pct" type="monotone" dataKey="pct" stroke="var(--primary)" strokeWidth={2} dot={{ r: 2.5, fill: "var(--primary)" }} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// Labour share on each day of the week. The crew is much the same every day and sales are not, so the quiet days run high.
export function WeekdayBars({ data, label }: { data: WeekdayPoint[]; label: string }) {
  const max = Math.max(...data.map((d) => d.pct), TARGET) * 1.15;
  return (
    <div role="img" aria-label={label} className="h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 22, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
          <YAxis tick={axis} tickLine={false} axisLine={false} width={40} domain={[0, max]} tickFormatter={(v) => `${Number(v).toFixed(0)}%`} />
          <ReferenceLine y={TARGET} stroke="var(--muted-foreground)" strokeDasharray="6 5" label={{ value: `Target ${TARGET}%`, position: "insideTopRight", fill: "var(--muted-foreground)", fontSize: 11 }} />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            content={(p) => {
              const { active, payload } = p as unknown as { active?: boolean; payload?: { payload: WeekdayPoint }[] };
              const d = active && payload?.[0]?.payload;
              if (!d) return null;
              return (
                <div style={box} className="min-w-48 px-3 py-2.5 shadow-sm">
                  <p className="mb-1 font-semibold">{d.label}</p>
                  {line("Labour share", `${d.pct.toFixed(1)}%`)}
                  {line("Labour cost", fmtFull("sales", d.cost))}
                  {line("Net sales", fmtFull("sales", d.sales))}
                </div>
              );
            }}
          />
          <Bar dataKey="pct" radius={[4, 4, 0, 0]} maxBarSize={52} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.label} fill={d.pct > TARGET ? "var(--primary)" : "var(--muted-foreground)"} fillOpacity={d.pct > TARGET ? 0.9 : 0.6} />
            ))}
            <LabelList dataKey="pct" position="top" formatter={(v) => `${Number(v).toFixed(1)}%`} style={{ fontSize: 12, fontWeight: 600, fill: "var(--foreground)" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const VERDICT = { short: "Short of staff: one person serves much more than usual", even: "About right", many: "Too many staff: one person serves much less than usual" } as const;

// An average day, hour by hour: the sales as columns and the staff on shift as a line. Columns in red are hours where one
// person serves far more sales than usual (short of staff), grey hours are about right, and pale hours have too many staff.
export function HourChart({ data, label }: { data: HourPoint[]; label: string }) {
  return (
    <div role="img" aria-label={label} className="h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={{ stroke: "var(--border)" }} interval={0} />
          <YAxis yAxisId="rm" tick={axis} tickLine={false} axisLine={false} width={52} tickFormatter={(v) => rmk(Number(v))} />
          <YAxis yAxisId="staff" orientation="right" domain={[0, "dataMax + 1"]} tick={axis} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            content={(p) => {
              const { active, payload } = p as unknown as { active?: boolean; payload?: { payload: HourPoint }[] };
              const d = active && payload?.[0]?.payload;
              if (!d) return null;
              return (
                <div style={box} className="min-w-56 px-3 py-2.5 shadow-sm">
                  <p className="mb-1 font-semibold">{d.label}</p>
                  {line("Sales in the hour", fmtFull("sales", d.sales))}
                  {line("Staff on shift", d.staff.toFixed(1))}
                  {line("Sales for each staff", fmtFull("sales", d.perStaff))}
                  <p className="mt-1.5 border-t pt-1.5">{VERDICT[d.verdict]}</p>
                </div>
              );
            }}
          />
          <Bar yAxisId="rm" dataKey="sales" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.label} fill={d.verdict === "short" ? "var(--primary)" : "var(--muted-foreground)"} fillOpacity={d.verdict === "short" ? 0.9 : d.verdict === "many" ? 0.3 : 0.6} />
            ))}
          </Bar>
          <Line yAxisId="staff" type="stepAfter" dataKey="staff" stroke="var(--foreground)" strokeWidth={2} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
