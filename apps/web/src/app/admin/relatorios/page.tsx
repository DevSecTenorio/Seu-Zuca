import type { Metadata } from "next";
import { Download } from "lucide-react";
import { requireUser } from "@/lib/auth/require-user";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PeriodSelect } from "@/components/period-select";
import { REPORT_KEYS, REPORT_LABELS } from "@/server/queries/reports";
import { PERIOD_LABELS, type AnalyticsPeriod } from "@/lib/analytics-period";

export const metadata: Metadata = { title: "Relatórios — Admin — Seu Zuca" };

const VALID_PERIODS: AnalyticsPeriod[] = ["7d", "30d", "3m", "6m"];
const FORMATS = [
  { key: "csv", label: "CSV" },
  { key: "excel", label: "Excel" },
  { key: "pdf", label: "PDF" },
] as const;

export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  await requireUser(["admin"]);
  const { periodo } = await searchParams;
  const period = VALID_PERIODS.includes(periodo as AnalyticsPeriod) ? (periodo as AnalyticsPeriod) : "30d";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Relatórios</h1>
          <p className="mt-1 text-muted-foreground">Período: {PERIOD_LABELS[period]}</p>
        </div>
        <PeriodSelect current={period} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {REPORT_KEYS.map((key) => (
          <Card key={key}>
            <CardHeader>
              <CardTitle className="text-base">{REPORT_LABELS[key]}</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-2">
              {FORMATS.map((format) => (
                <Button key={format.key} asChild variant="outline" size="sm">
                  <a href={`/api/admin/relatorios/${key}?formato=${format.key}&periodo=${period}`}>
                    <Download className="size-4" /> {format.label}
                  </a>
                </Button>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
