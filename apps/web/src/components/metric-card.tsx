import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Shows "--" for a metric with insufficient data, instead of 0 or NaN — SPEC.md's explicit
 * requirement for the Analytics tabs. */
export function MetricCard({ label, value, hint }: { label: string; value: string | number | null; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl">{value === null || value === undefined ? "--" : value}</CardTitle>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardHeader>
    </Card>
  );
}
