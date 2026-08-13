import * as XLSX from "xlsx";
import { MAX_IMPORT_BYTES, MAX_IMPORT_ROWS } from "../application/contracts";
import { Problem } from "@/shared/errors/problem";

export function readSpreadsheet(buffer: ArrayBuffer, fileName: string) {
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
  let workbook: XLSX.WorkBook;
  try {
    workbook = isCsv
      ? XLSX.read(new TextDecoder("utf-8", { fatal: true }).decode(bytes), {
          type: "string",
          raw: true,
        })
      : XLSX.read(buffer, { type: "array", cellDates: false });
  } catch {
    throw new Problem(
      "validation",
      "无法读取文件，请确认文件未损坏且采用 UTF-8 编码。",
      400,
    );
  }
  const firstName = workbook.SheetNames[0];
  if (!firstName) throw new Problem("validation", "文件中没有工作表。", 400);
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    workbook.Sheets[firstName],
    { defval: "", raw: false },
  );
  if (rows.length > MAX_IMPORT_ROWS) {
    throw new Problem("payload_too_large", "数据不得超过 10,000 行。", 413);
  }
  return rows;
}
