import * as XLSX from "xlsx";
import { escapeSpreadsheetFormula } from "../application/import-schema";

function safeRows(rows: Record<string, unknown>[]) {
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key,
        escapeSpreadsheetFormula(value),
      ]),
    ),
  );
}

export function rowsToCsv(rows: Record<string, unknown>[]) {
  return XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(safeRows(rows)));
}

function safeHyperlink(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export function rowsToXlsx(
  rows: Record<string, unknown>[],
  options: { hyperlinkColumns?: string[] } = {},
) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(safeRows(rows));
  const headers = Object.keys(rows[0] ?? {});
  for (const column of options.hyperlinkColumns ?? []) {
    const columnIndex = headers.indexOf(column);
    if (columnIndex < 0) continue;
    rows.forEach((row, rowIndex) => {
      const target = safeHyperlink(row[column]);
      const cell =
        sheet[XLSX.utils.encode_cell({ r: rowIndex + 1, c: columnIndex })];
      if (target && cell) {
        cell.l = { Target: target, Tooltip: "打开职位链接" };
      }
    });
  }
  XLSX.utils.book_append_sheet(workbook, sheet, "投递记录");
  return XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
    compression: true,
  });
}
