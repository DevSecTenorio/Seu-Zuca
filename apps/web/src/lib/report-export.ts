import "server-only";
import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { ReportTable } from "@/server/queries/reports";

function csvEscape(value: string | number): string {
  const str = String(value);
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function toCSV(table: ReportTable): string {
  const bom = "﻿"; // Excel needs a UTF-8 BOM to not mangle accented characters.
  const lines = [table.columns, ...table.rows].map((row) => row.map(csvEscape).join(","));
  return bom + lines.join("\r\n");
}

export async function toExcelBuffer(title: string, table: ReportTable): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(title.slice(0, 31)); // Excel sheet name limit
  sheet.addRow(table.columns);
  sheet.getRow(1).font = { bold: true };
  for (const row of table.rows) sheet.addRow(row);
  sheet.columns.forEach((col) => {
    col.width = 20;
  });
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

const PAGE_MARGIN = 40;
const ROW_HEIGHT = 16;
const FONT_SIZE = 8;

/**
 * Minimal tabular PDF renderer using pdf-lib (no filesystem access, unlike pdfkit's bundled AFM
 * font files) — safer under Vercel's serverless bundling. Paginates when rows overflow the page;
 * columns are equal-width and truncate long values rather than wrap, which keeps this simple
 * enough to not need a full layout engine for what are ultimately data-export reports.
 */
export async function toPDFBuffer(title: string, table: ReportTable, subtitle: string): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 792; // US Letter landscape
  const pageHeight = 612;
  const usableWidth = pageWidth - PAGE_MARGIN * 2;
  const colWidth = usableWidth / table.columns.length;
  const maxCharsPerCol = Math.floor(colWidth / (FONT_SIZE * 0.55));

  function truncate(value: string): string {
    return value.length > maxCharsPerCol ? `${value.slice(0, maxCharsPerCol - 1)}…` : value;
  }

  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - PAGE_MARGIN;

  function drawHeader() {
    page.drawText(title, { x: PAGE_MARGIN, y, size: 14, font: boldFont, color: rgb(0.1, 0.1, 0.1) });
    y -= 18;
    page.drawText(subtitle, { x: PAGE_MARGIN, y, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
    y -= 20;
    table.columns.forEach((col, i) => {
      page.drawText(truncate(col), { x: PAGE_MARGIN + i * colWidth, y, size: FONT_SIZE, font: boldFont });
    });
    y -= ROW_HEIGHT;
    page.drawLine({
      start: { x: PAGE_MARGIN, y: y + 4 },
      end: { x: pageWidth - PAGE_MARGIN, y: y + 4 },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7),
    });
  }

  drawHeader();

  for (const row of table.rows) {
    if (y < PAGE_MARGIN + ROW_HEIGHT) {
      page = doc.addPage([pageWidth, pageHeight]);
      y = pageHeight - PAGE_MARGIN;
      drawHeader();
    }
    row.forEach((cell, i) => {
      page.drawText(truncate(String(cell)), { x: PAGE_MARGIN + i * colWidth, y, size: FONT_SIZE, font });
    });
    y -= ROW_HEIGHT;
  }

  if (table.rows.length === 0) {
    page.drawText("Sem dados para o período selecionado.", { x: PAGE_MARGIN, y, size: FONT_SIZE, font });
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
