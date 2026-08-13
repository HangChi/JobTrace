import { basename } from "node:path";
import { readSpreadsheet } from "../infrastructure/spreadsheet-reader";
import { PostgresImportRepository } from "../infrastructure/postgres-import-repository";
import { normalizeImportRow, validateImportRow } from "./import-schema";
import type { ImportPreview } from "./contracts";

export async function previewImport(file: File): Promise<ImportPreview> {
  const repository = new PostgresImportRepository();
  await repository.cleanupExpired();
  const raw = readSpreadsheet(await file.arrayBuffer(), file.name);
  const rows = raw.map((value, index) => {
    const result = validateImportRow(value);
    return {
      rowNumber: index + 2,
      data: result.success ? normalizeImportRow(value) : null,
      errors: result.success
        ? []
        : result.error.issues.map((issue) => ({
            field: String(issue.path[0] ?? "row"),
            code: issue.code,
            message: issue.message,
          })),
      duplicateApplicationIds: [],
    };
  });
  await repository.findDuplicates(rows);
  const safeName = basename(file.name)
    .replace(/[^\p{L}\p{N}._-]/gu, "_")
    .slice(0, 255);
  const format = file.name.toLowerCase().endsWith(".xlsx") ? "xlsx" : "csv";
  return repository.savePreview(safeName || "import", format, rows);
}
