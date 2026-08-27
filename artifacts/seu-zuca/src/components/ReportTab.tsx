import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileDown, FileSpreadsheet, FileText, Search, BarChart3, AlertCircle, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type ReportColumn = {
  key: string;
  label: string;
  format?: (v: unknown) => string;
  align?: "left" | "right" | "center";
};

export type SummaryItem = {
  key: string;
  label: string;
  format?: (v: unknown) => string;
  color?: string;
  bgColor?: string;
};

type ReportType = { value: string; label: string };
type ExportFormat = "csv" | "xlsx" | "pdf";

type Props = {
  title: string;
  endpoint: string;
  columns: ReportColumn[];
  summaryItems?: SummaryItem[];
  reportTypes?: ReportType[];
  defaultType?: string;
  filenamePrefix?: string;
};

function today() {
  return new Date().toISOString().split("T")[0];
}

function firstOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
}

function fmtCell(col: ReportColumn, row: Record<string, unknown>): string {
  const v = row[col.key];
  if (v === null || v === undefined) return "—";
  if (col.format) return col.format(v);
  return String(v);
}

const FORMAT_OPTS: { value: ExportFormat; label: string; icon: React.ElementType; color: string }[] = [
  { value: "pdf",  label: "PDF",   icon: FileText,        color: "text-red-600 border-red-300 bg-red-50"   },
  { value: "xlsx", label: "Excel", icon: FileSpreadsheet,  color: "text-blue-600 border-blue-300 bg-blue-50" },
  { value: "csv",  label: "CSV",   icon: FileDown,         color: "text-emerald-600 border-emerald-300 bg-emerald-50" },
];

export default function ReportTab({
  title,
  endpoint,
  columns,
  summaryItems,
  reportTypes,
  defaultType,
  filenamePrefix = "relatorio",
}: Props) {
  const { toast } = useToast();
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [type, setType] = useState(defaultType || reportTypes?.[0]?.value || "");
  const [format, setFormat] = useState<ExportFormat>("pdf");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [summary, setSummary] = useState<Record<string, unknown>>({});
  const [fetched, setFetched] = useState(false);

  function getFilename(ext: string) {
    return `${filenamePrefix}_${from}_a_${to}.${ext}`;
  }

  function getSheetData() {
    return data.map(row =>
      Object.fromEntries(columns.map(col => [col.label, fmtCell(col, row)]))
    );
  }

  function doCSV(rows: Record<string, unknown>[]) {
    const sheetData = rows.map(row =>
      Object.fromEntries(columns.map(col => [col.label, fmtCell(col, row)]))
    );
    const ws = XLSX.utils.json_to_sheet(sheetData);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = getFilename("csv");
    a.click();
    URL.revokeObjectURL(url);
  }

  function doXLSX(rows: Record<string, unknown>[]) {
    const sheetData = rows.map(row =>
      Object.fromEntries(columns.map(col => [col.label, fmtCell(col, row)]))
    );
    const ws = XLSX.utils.json_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatório");
    ws["!cols"] = columns.map(() => ({ wch: 22 }));
    XLSX.writeFile(wb, getFilename("xlsx"));
  }

  function doPDF(rows: Record<string, unknown>[], sum: Record<string, unknown>) {
    const doc = new jsPDF({ orientation: columns.length > 5 ? "landscape" : "portrait" });
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(title, 14, 16);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120);
    doc.text(`Período: ${from} a ${to}`, 14, 24);
    doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 14, 30);

    let startY = 36;
    if (summaryItems && summaryItems.length > 0) {
      doc.setTextColor(0);
      doc.setFontSize(9);
      const summaryText = summaryItems
        .map(s => `${s.label}: ${s.format ? s.format(sum[s.key]) : (sum[s.key] ?? "—")}`)
        .join("   |   ");
      doc.text(summaryText, 14, 38);
      startY = 44;
    }

    autoTable(doc, {
      startY,
      head: [columns.map(c => c.label)],
      body: rows.map(row => columns.map(col => fmtCell(col, row))),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [192, 24, 26], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      columnStyles: Object.fromEntries(
        columns.map((col, i) => [i, { halign: col.align || "left" }])
      ),
    });

    doc.save(getFilename("pdf"));
  }

  async function handleGenerate() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from, to });
      if (type) params.set("type", type);
      const url = `/api/${endpoint}?${params.toString()}`;
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) throw new Error(`Erro HTTP ${r.status}`);
      const json = await r.json();
      const rows: Record<string, unknown>[] = json.rows || [];
      const sum: Record<string, unknown> = json.summary || {};

      setData(rows);
      setSummary(sum);
      setFetched(true);

      if (rows.length === 0) {
        toast({ title: "Nenhum registro encontrado no período", variant: "default" });
        return;
      }

      if (format === "csv") doCSV(rows);
      else if (format === "xlsx") doXLSX(rows);
      else doPDF(rows, sum);

      const fmtLabel = FORMAT_OPTS.find(f => f.value === format)?.label || format.toUpperCase();
      toast({ title: `Relatório ${fmtLabel} gerado com sucesso!` });
    } catch (e) {
      console.error(e);
      toast({ title: "Erro ao gerar relatório. Tente novamente.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function handleReExport(fmt: ExportFormat) {
    if (data.length === 0) return;
    const prev = format;
    if (fmt === "csv") doCSV(data);
    else if (fmt === "xlsx") doXLSX(data);
    else doPDF(data, summary);
    const fmtLabel = FORMAT_OPTS.find(f => f.value === fmt)?.label || fmt.toUpperCase();
    toast({ title: `${fmtLabel} exportado com sucesso` });
    void prev;
  }

  const hasData = fetched && data.length > 0;
  const isEmpty = fetched && data.length === 0;

  return (
    <div className="space-y-4">
      <Card className="shadow-none border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 size={18} className="text-[#C0181A]" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* Row 1: Dates + type selector */}
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Data inicial</label>
              <input
                type="date"
                value={from}
                max={to}
                onChange={e => setFrom(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C0181A]/30 focus:border-[#C0181A]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Data final</label>
              <input
                type="date"
                value={to}
                min={from}
                onChange={e => setTo(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C0181A]/30 focus:border-[#C0181A]"
              />
            </div>
            {reportTypes && reportTypes.length > 1 && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
                <select
                  value={type}
                  onChange={e => { setType(e.target.value); setFetched(false); setData([]); }}
                  className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C0181A]/30 focus:border-[#C0181A] bg-white"
                >
                  {reportTypes.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Row 2: Format selector */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Formato do arquivo</label>
            <div className="flex gap-2 flex-wrap">
              {FORMAT_OPTS.map(opt => {
                const Icon = opt.icon;
                const selected = format === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setFormat(opt.value)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                      selected
                        ? `${opt.color} border-current ring-2 ring-offset-1 ring-current/30`
                        : "border-gray-200 text-gray-500 bg-white hover:border-gray-300"
                    }`}
                  >
                    <Icon size={16} />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Row 3: Generate button */}
          <Button
            onClick={handleGenerate}
            disabled={loading}
            className="bg-[#C0181A] hover:bg-[#a01418] gap-2 w-full sm:w-auto"
          >
            <Download size={16} />
            {loading ? "Gerando..." : `Gerar e baixar ${FORMAT_OPTS.find(f => f.value === format)?.label}`}
          </Button>

          {/* Summary pills */}
          {summaryItems && hasData && (
            <div className="flex flex-wrap gap-3 pt-1">
              {summaryItems.map(s => (
                <div
                  key={s.key}
                  className={`flex flex-col px-4 py-2 rounded-lg border ${s.bgColor || "bg-gray-50 border-gray-200"}`}
                >
                  <span className={`text-xs ${s.color || "text-gray-500"} font-medium`}>{s.label}</span>
                  <span className="text-lg font-bold text-gray-900">
                    {s.format ? s.format(summary[s.key]) : String(summary[s.key] ?? "—")}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Re-export buttons (shown only after fetching) */}
          {hasData && (
            <div className="flex gap-2 flex-wrap items-center pt-1 border-t">
              <span className="text-xs text-muted-foreground">Baixar novamente:</span>
              {FORMAT_OPTS.map(opt => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    onClick={() => handleReExport(opt.value)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium text-gray-600 bg-white hover:bg-gray-50 transition-colors"
                  >
                    <Icon size={13} />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {isEmpty && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <AlertCircle size={40} className="opacity-30" />
          <p className="text-base font-medium">Nenhum registro encontrado</p>
          <p className="text-sm">Ajuste o período e tente novamente</p>
        </div>
      )}

      {hasData && (
        <Card className="shadow-none border">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    {columns.map(col => (
                      <th
                        key={col.key}
                        className={`px-4 py-3 text-xs font-semibold text-gray-600 whitespace-nowrap ${
                          col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                        }`}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50/60 transition-colors">
                      {columns.map(col => (
                        <td
                          key={col.key}
                          className={`px-4 py-3 text-sm text-gray-800 ${
                            col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                          }`}
                        >
                          {fmtCell(col, row)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 border-t text-xs text-muted-foreground bg-gray-50">
              {data.length} {data.length === 1 ? "registro" : "registros"}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
