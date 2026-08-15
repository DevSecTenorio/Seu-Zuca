"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCentsToBRL } from "@/lib/format";
import type { FinancialPoint } from "@/server/queries/analytics";

function formatBucketLabel(bucket: string): string {
  if (bucket.includes("-S")) return bucket.replace("-S", " · sem. ");
  const [, month, day] = bucket.split("-");
  return `${day}/${month}`;
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="text-xs text-muted-foreground">{formatBucketLabel(String(label))}</p>
      <p className="font-medium text-foreground">{formatCentsToBRL(payload[0].value)}</p>
    </div>
  );
}

/** Single-series area chart (GMV over time) — per dataviz guidance, a lone series needs no
 * legend (the card title names it) and stays on one axis; commission revenue is shown alongside
 * as a separate stat, not a second scale on this same chart. */
export function FinancialChart({ series }: { series: FinancialPoint[] }) {
  if (series.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
        Sem pedidos no período selecionado.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={224}>
      <AreaChart data={series} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="gmv-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="bucket"
          tickFormatter={formatBucketLabel}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          axisLine={{ stroke: "var(--border)" }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => `${Math.round(v / 100)}`}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--border)" }} />
        <Area
          type="monotone"
          dataKey="gmvCents"
          stroke="var(--primary)"
          strokeWidth={2}
          fill="url(#gmv-fill)"
          dot={false}
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
