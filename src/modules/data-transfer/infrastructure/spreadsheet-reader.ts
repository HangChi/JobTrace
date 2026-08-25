import { Readable } from "node:stream";
import ExcelJS from "exceljs";
import { MAX_IMPORT_BYTES, MAX_IMPORT_ROWS } from "../application/contracts";
import { Problem } from "@/shared/errors/problem";

const MAX_IMPORT_COLUMNS = 100;
const MAX_IMPORT_CELLS = 200_000;

function worksheetRows(worksheet: ExcelJS.Worksheet) {
  const columnCount = worksheet.actualColumnCount;
  const rowCount = worksheet.actualRowCount;
  if (
    columnCount > MAX_IMPORT_COLUMNS ||
    rowCount * columnCount > MAX_IMPORT_CELLS
  ) {
    throw new Problem(
      "payload_too_large",
      "表格列数或单元格数量超出允许范围。",
      413,
    );
  }
  if (rowCount - 1 > MAX_IMPORT_ROWS) {
    throw new Problem("payload_too_large", "数据不得超过 10,000 行。", 413);
  }

  const headers = Array.from({ length: columnCount }, (_, index) =>
    worksheet
      .getRow(1)
      .getCell(index + 1)
      .text.trim(),
  );
  if (!headers.some(Boolean)) {
    throw new Problem("validation", "文件中没有表头。", 400);
  }

  const rows: Record<string, unknown>[] = [];
  for (let rowNumber = 2; rowNumber <= rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const values = headers.map((header, index) => ({
      header,
      value: row.getCell(index + 1).text,
    }));
    if (!values.some(({ value }) => value !== "")) continue;
    rows.push(
      Object.fromEntries(
        values.flatMap(({ header, value }) =>
          header ? [[header, value]] : [],
        ),
      ),
    );
  }
  return rows;
}

export async function readSpreadsheet(buffer: ArrayBuffer, fileName: string) {
  if (buffer.byteLength > MAX_IMPORT_BYTES) {
    throw new Problem("payload_too_large", "文件不得超过 5MB。", 413);
  }
  const isCsv = fileName.toLowerCase().endsWith(".csv");
  const isXlsx = fileName.toLowerCase().endsWith(".xlsx");
  if (!isCsv && !isXlsx) {
    throw new Problem("unsupported_format", "仅支持 CSV 或 XLSX。", 415);
  }
  const bytes = new Uint8Array(buffer);
  if (isXlsx && (bytes[0] !== 0x50 || bytes[1] !== 0x4b)) {
    throw new Problem("unsupported_format", "文件内容不是有效的 XLSX。", 415);
  }
  if (isCsv && bytes.includes(0)) {
    throw new Problem(
      "unsupported_format",
      "CSV 文件包含无效的二进制内容。",
      415,
    );
  }

  const workbook = new ExcelJS.Workbook();
  try {
    if (isCsv) {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      await workbook.csv.read(Readable.from([text]), { dateFormats: [] });
    } else {
      await workbook.xlsx.load(buffer);
    }
  } catch (error) {
    if (error instanceof Problem) throw error;
    throw new Problem(
      "validation",
      "无法读取文件，请确认文件未损坏且采用 UTF-8 编码。",
      400,
    );
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Problem("validation", "文件中没有工作表。", 400);
  return worksheetRows(worksheet);
}
