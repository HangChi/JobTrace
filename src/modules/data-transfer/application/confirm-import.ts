import { PostgresImportRepository } from "../infrastructure/postgres-import-repository";
import type {
  ImportDecision,
  ImportResult,
  ImportResultRow,
} from "./contracts";
import { requireUser } from "@/modules/identity-access";
import { Problem } from "@/shared/errors/problem";

export async function confirmImport(
  id: string,
  decisions: ImportDecision[],
): Promise<ImportResult> {
  const actor = await requireUser();
  const repository = new PostgresImportRepository();
  await repository.cleanupExpired();
  let confirmed: ImportResultRow[];
  try {
    confirmed = await repository.confirmBatch(actor.id, id, decisions);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "P0002") {
      throw new Problem("not_found", "没有找到该导入批次。", 404);
    }
    if (code === "40001") {
      throw new Problem(
        "import_batch_conflict",
        "该导入批次已处理或已过期。",
        409,
      );
    }
    throw error;
  }
  const results: ImportResultRow[] = confirmed.map((row) =>
    row.result === "failed"
      ? {
          ...row,
          error: {
            code: row.error?.code ?? "import_row_failed",
            message: row.error?.message ?? "该行导入失败。",
            requestId: crypto.randomUUID(),
          },
        }
      : row,
  );
  return {
    created: results.filter((row) => row.result === "created").length,
    skipped: results.filter((row) => row.result === "skipped").length,
    failed: results.filter((row) => row.result === "failed").length,
    rows: results,
  };
}
