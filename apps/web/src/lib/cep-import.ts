import "server-only";
import ExcelJS from "exceljs";
import type { CoverageCepRange, CoverageMunicipio } from "./delivery-coverage";

/** Hard cap so an accidental multi-million-row upload can't hang the request or blow past
 * FormData/serialization limits — comfortably above any real CEP mesh for a single supplier. */
export const MAX_CEP_IMPORT_ROWS = 20_000;

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining accents left over after NFD normalization
    .replace(/[^a-z0-9]/g, "");
}

function isCep(value: string): boolean {
  return /^\d{5}-?\d{3}$/.test(value.trim());
}

function parseRows(headerRow: string[], dataRows: string[][]): CoverageCepRange[] {
  const normalizedHeaders = headerRow.map(normalizeHeader);
  const singleIdx = normalizedHeaders.findIndex((h) => h === "cep");
  const startIdx = normalizedHeaders.findIndex((h) => ["cepinicial", "cepde", "cepinicio", "cepstart"].includes(h));
  const endIdx = normalizedHeaders.findIndex((h) => ["cepfinal", "cepate", "cepfim", "cepend"].includes(h));

  const ranges: CoverageCepRange[] = [];
  for (const row of dataRows) {
    if (startIdx >= 0 && endIdx >= 0) {
      const start = row[startIdx]?.trim();
      const end = row[endIdx]?.trim();
      if (start && end && isCep(start) && isCep(end)) ranges.push({ cepStart: start, cepEnd: end });
    } else if (singleIdx >= 0) {
      const cep = row[singleIdx]?.trim();
      if (cep && isCep(cep)) ranges.push({ cepStart: cep, cepEnd: cep });
    }
  }
  return ranges;
}

function parseCsv(text: string): string[][] {
  return text
    .split(/\r\n|\n|\r/)
    .filter((line) => line.trim().length > 0)
    .map((line) => line.split(",").map((cell) => cell.trim().replace(/^"|"$/g, "")));
}

export type CepImportParseResult =
  | { ok: true; ranges: CoverageCepRange[] }
  | { ok: false; error: string };

/**
 * Reads an uploaded spreadsheet (.xlsx) or .csv of CEPs into a flat list of ranges. Expects
 * either a single "cep" column, or a pair of "cep_inicial"/"cep_final" columns (case/accent
 * insensitive, a few common spellings accepted) — see normalizeHeader.
 */
export async function parseCepSpreadsheet(file: File): Promise<CepImportParseResult> {
  const name = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  let headerRow: string[];
  let dataRows: string[][];

  if (name.endsWith(".csv")) {
    const rows = parseCsv(buffer.toString("utf8"));
    if (rows.length === 0) return { ok: false, error: "Planilha vazia." };
    [headerRow, ...dataRows] = rows;
  } else {
    const workbook = new ExcelJS.Workbook();
    try {
      // exceljs's bundled types were compiled against an older @types/node Buffer shape than
      // this project's; the runtime value is a perfectly normal Buffer.
      await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    } catch {
      return { ok: false, error: "Não foi possível ler o arquivo. Envie um .xlsx ou .csv." };
    }
    const sheet = workbook.worksheets[0];
    if (!sheet || sheet.rowCount === 0) return { ok: false, error: "Planilha vazia." };
    const allRows: string[][] = [];
    sheet.eachRow((row) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell) => {
        cells.push(cell.text ?? "");
      });
      allRows.push(cells);
    });
    [headerRow, ...dataRows] = allRows;
  }

  if (!headerRow) return { ok: false, error: "Planilha vazia." };
  if (dataRows.length > MAX_CEP_IMPORT_ROWS) {
    return { ok: false, error: `A planilha tem mais de ${MAX_CEP_IMPORT_ROWS.toLocaleString("pt-BR")} linhas.` };
  }

  const ranges = parseRows(headerRow, dataRows);
  if (ranges.length === 0) {
    return {
      ok: false,
      error: 'Nenhum CEP reconhecido. Use uma coluna "cep", ou "cep_inicial" + "cep_final" para faixas.',
    };
  }
  return { ok: true, ranges };
}

/** Parses the manual "one per line" textarea in the coverage rule form — a bare CEP for a single
 * one, or "inicio,fim" for a range. Silently skips blank lines and lines that don't parse, since
 * this is a free-text field the fornecedor is actively typing into. */
export function parseManualCepText(text: string): CoverageCepRange[] {
  const ranges: CoverageCepRange[] = [];
  for (const line of text.split(/\r\n|\n|\r/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(",").map((p) => p.trim());
    if (parts.length >= 2 && isCep(parts[0]) && isCep(parts[1])) {
      ranges.push({ cepStart: parts[0], cepEnd: parts[1] });
    } else if (parts.length === 1 && isCep(parts[0])) {
      ranges.push({ cepStart: parts[0], cepEnd: parts[0] });
    }
  }
  return ranges;
}

/** Parses the manual "one per line" textarea for municípios: "Cidade,UF" per line. */
export function parseManualMunicipioText(text: string): CoverageMunicipio[] {
  const municipios: CoverageMunicipio[] = [];
  for (const line of text.split(/\r\n|\n|\r/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(",").map((p) => p.trim());
    if (parts.length >= 2 && parts[0] && /^[a-zA-Z]{2}$/.test(parts[1])) {
      municipios.push({ cidade: parts[0], estado: parts[1].toUpperCase() });
    }
  }
  return municipios;
}

export type CepImportDiff = {
  added: number;
  removed: number;
  unchanged: number;
  totalParsed: number;
};

function rangeKey(r: CoverageCepRange): string {
  return `${r.cepStart}|${r.cepEnd}`;
}

export function diffCepRanges(current: CoverageCepRange[], incoming: CoverageCepRange[]): CepImportDiff {
  const currentKeys = new Set(current.map(rangeKey));
  const incomingKeys = new Set(incoming.map(rangeKey));
  let added = 0;
  let unchanged = 0;
  for (const key of incomingKeys) {
    if (currentKeys.has(key)) unchanged++;
    else added++;
  }
  let removed = 0;
  for (const key of currentKeys) {
    if (!incomingKeys.has(key)) removed++;
  }
  return { added, removed, unchanged, totalParsed: incoming.length };
}
