import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { REPORT_KEYS, REPORT_LABELS, getReport, type ReportKey } from "@/server/queries/reports";
import { PERIOD_LABELS, type AnalyticsPeriod } from "@/lib/analytics-period";
import { toCSV, toExcelBuffer, toPDFBuffer } from "@/lib/report-export";

const VALID_PERIODS: AnalyticsPeriod[] = ["7d", "30d", "3m", "6m"];
const VALID_FORMATS = ["csv", "excel", "pdf"] as const;

export async function GET(request: NextRequest, { params }: { params: Promise<{ report: string }> }) {
  await requireUser(["admin"]);

  const { report } = await params;
  if (!REPORT_KEYS.includes(report as ReportKey)) {
    return NextResponse.json({ error: "Relatório desconhecido." }, { status: 404 });
  }
  const reportKey = report as ReportKey;

  const searchParams = request.nextUrl.searchParams;
  const periodo = searchParams.get("periodo");
  const period = VALID_PERIODS.includes(periodo as AnalyticsPeriod) ? (periodo as AnalyticsPeriod) : "30d";
  const formato = searchParams.get("formato");
  if (!VALID_FORMATS.includes(formato as (typeof VALID_FORMATS)[number])) {
    return NextResponse.json({ error: "Formato inválido. Use csv, excel ou pdf." }, { status: 400 });
  }

  const table = await getReport(reportKey, period);
  const title = REPORT_LABELS[reportKey];
  const filenameBase = `${reportKey}-${period}`;

  if (formato === "csv") {
    return new NextResponse(toCSV(table), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filenameBase}.csv"`,
      },
    });
  }

  if (formato === "excel") {
    const buffer = await toExcelBuffer(title, table);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filenameBase}.xlsx"`,
      },
    });
  }

  const buffer = await toPDFBuffer(title, table, `Período: ${PERIOD_LABELS[period]}`);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filenameBase}.pdf"`,
    },
  });
}
