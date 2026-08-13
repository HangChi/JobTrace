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

export function rowsToXlsx(rows: Record<string, unknown>[]) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(safeRows(rows)),
    "投递记录",
  );
  return XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
    compression: true,
  });
}
