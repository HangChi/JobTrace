import ExcelJS from "exceljs";
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

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function rowsToCsv(rows: Record<string, unknown>[]) {
  const safe = safeRows(rows);
  const headers = Object.keys(safe[0] ?? {});
  return [
    headers.map(csvCell).join(","),
    ...safe.map((row) =>
      headers.map((header) => csvCell(row[header])).join(","),
    ),
  ].join("\n");
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

export async function rowsToXlsx(
  rows: Record<string, unknown>[],
  options: { hyperlinkColumns?: string[] } = {},
) {
  const safe = safeRows(rows);
  const headers = Object.keys(safe[0] ?? {});
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("投递记录");
  worksheet.addRow(headers);
  safe.forEach((row) => worksheet.addRow(headers.map((header) => row[header])));

  for (const column of options.hyperlinkColumns ?? []) {
    const columnIndex = headers.indexOf(column);
    if (columnIndex < 0) continue;
    rows.forEach((row, rowIndex) => {
      const target = safeHyperlink(row[column]);
      if (!target) return;
      worksheet.getCell(rowIndex + 2, columnIndex + 1).value = {
        text: String(safe[rowIndex][column] ?? ""),
        hyperlink: target,
        tooltip: "打开职位链接",
      };
    });
  }

  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
