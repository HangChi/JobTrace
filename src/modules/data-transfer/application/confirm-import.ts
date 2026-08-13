import { createApplication } from "@/modules/applications";
import { Problem } from "@/shared/errors/problem";
import { PostgresImportRepository } from "../infrastructure/postgres-import-repository";
import type {
  ImportDecision,
  ImportResult,
  ImportResultRow,
} from "./contracts";
import { requireUser } from "@/modules/identity-access";

export async function confirmImport(
  id: string,
  decisions: ImportDecision[],
): Promise<ImportResult> {
  const actor = await requireUser();
  const repository = new PostgresImportRepository();
  await repository.cleanupExpired();
  const { rows } = await repository.getBatch(actor.id, id);
  const decisionMap = new Map(
    decisions.map((item) => [item.rowNumber, item.action]),
  );
  await repository.markProcessing(actor.id, id);
  const results: ImportResultRow[] = [];
  for (const row of rows) {
    const rowNumber = Number(row.rowNumber);
    const errors = row.errors as unknown[];
    const action = decisionMap.get(rowNumber) ?? "skip";
    if (action === "skip" || errors.length || !row.normalizedData) {
      const result: ImportResultRow = {
        rowNumber,
        result: "skipped",
        applicationId: null,
        error: null,
      };
      results.push(result);
      await repository.recordResult(actor.id, id, result, "skip");
      continue;
    }
    try {
      const normalizedData =
        typeof row.normalizedData === "string"
          ? JSON.parse(row.normalizedData)
          : row.normalizedData;
      const application = await createApplication(normalizedData);
      const result: ImportResultRow = {
        rowNumber,
        result: "created",
        applicationId: application.id,
        error: null,
      };
      results.push(result);
      await repository.recordResult(actor.id, id, result, "import");
    } catch (error) {
      const problem =
        error instanceof Problem
          ? error
          : new Problem("import_row_failed", "该行导入失败。", 400);
      const result: ImportResultRow = {
        rowNumber,
        result: "failed",
        applicationId: null,
        error: {
          code: problem.code,
          message: problem.message,
          requestId: crypto.randomUUID(),
        },
      };
      results.push(result);
      await repository.recordResult(actor.id, id, result, "import");
    }
  }
  await repository.complete(actor.id, id);
  return {
    created: results.filter((row) => row.result === "created").length,
    skipped: results.filter((row) => row.result === "skipped").length,
    failed: results.filter((row) => row.result === "failed").length,
    rows: results,
  };
}
