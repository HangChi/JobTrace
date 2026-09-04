import { basename } from "node:path";
import { readSpreadsheet } from "../infrastructure/spreadsheet-reader";
import { PostgresImportRepository } from "../infrastructure/postgres-import-repository";
import {
  applyImportMapping,
  inferImportMapping,
  normalizeImportRow,
  validateImportMapping,
  validateImportRow,
} from "./import-schema";
import type { ImportPreview } from "./contracts";
import { requireUser } from "@/modules/identity-access";

export async function previewImport(
  file: File,
  requestedMapping?: Record<string, string>,
  replaceBatchId?: string,
): Promise<ImportPreview> {
  const actor = await requireUser();
  const repository = new PostgresImportRepository();
  await repository.cleanupExpired();
  const spreadsheet = await readSpreadsheet(
    await file.arrayBuffer(),
    file.name,
  );
  const mapping = validateImportMapping(
    spreadsheet.columns,
    requestedMapping ?? inferImportMapping(spreadsheet.columns),
  );
  const rows = spreadsheet.rows.map((sourceRow, index) => {
    const value = applyImportMapping(sourceRow, mapping);
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
  await repository.findDuplicates(actor.id, rows);
  const safeName = basename(file.name)
    .replace(/[^\p{L}\p{N}._-]/gu, "_")
    .slice(0, 255);
  const format = file.name.toLowerCase().endsWith(".xlsx") ? "xlsx" : "csv";
  return repository.savePreview(
    actor.id,
    safeName || "import",
    format,
    mapping,
    rows,
    replaceBatchId,
  );
}
