import { createServerDatabase } from "@/shared/database";
import { Problem } from "@/shared/errors/problem";
import type {
  ImportPreview,
  ImportResultRow,
  ImportRow,
} from "../application/contracts";

type DbRow = Record<string, unknown>;

export class PostgresImportRepository {
  private sql = createServerDatabase();

  async cleanupExpired() {
    await this.sql`
      update public.import_batches set status = 'expired'
      where status = 'previewed' and expires_at <= now()
    `;
    await this.sql`
      delete from public.import_batches where expires_at < now() - interval '24 hours'
    `;
  }

  async findDuplicates(ownerId: string, rows: ImportRow[]) {
    for (const row of rows) {
      if (!row.data) continue;
      const matches = await this.sql<{ id: string }[]>`
        select id from public.applications
        where owner_id=${ownerId} and lower(company_name) = lower(${String(row.data.companyName)})
          and lower(position_name) = lower(${String(row.data.positionName)})
          and applied_date = ${String(row.data.appliedDate)}::date
        order by id
      `;
      row.duplicateApplicationIds = matches.map((match) => match.id);
    }
    return rows;
  }

  async savePreview(
    ownerId: string,
    fileName: string,
    format: "csv" | "xlsx",
    rows: ImportRow[],
  ) {
    const validRows = rows.filter((row) => !row.errors.length).length;
    const invalidRows = rows.length - validRows;
    const duplicateRows = rows.filter(
      (row) => row.duplicateApplicationIds.length,
    ).length;
    return this.sql.begin(async (sql) => {
      const [batch] = await sql<DbRow[]>`
        insert into public.import_batches(
          owner_id,file_name, format, total_rows, valid_rows, invalid_rows, duplicate_rows
        ) values (${ownerId},${fileName}, ${format}, ${rows.length}, ${validRows}, ${invalidRows}, ${duplicateRows})
        returning id, expires_at
      `;
      for (const row of rows) {
        await sql`
          insert into public.import_rows(
            batch_id, row_number, normalized_data, errors, duplicate_application_ids
          ) values (
            ${String(batch.id)}, ${row.rowNumber},
            ${row.data ? sql.json(row.data as never) : null}::jsonb,
            ${sql.json(row.errors)}::jsonb,
            ${row.duplicateApplicationIds}::uuid[]
          )
        `;
      }
      return {
        id: String(batch.id),
        expiresAt: new Date(String(batch.expiresAt)).toISOString(),
        totalRows: rows.length,
        validRows,
        invalidRows,
        duplicateRows,
        columns: {},
        rows,
      } satisfies ImportPreview;
    });
  }

  async getBatch(ownerId: string, id: string) {
    const [batch] = await this.sql<DbRow[]>`
      select * from public.import_batches where id = ${id} and owner_id=${ownerId}
    `;
    if (!batch) throw new Problem("not_found", "没有找到该导入批次。", 404);
    if (
      String(batch.status) !== "previewed" ||
      new Date(String(batch.expiresAt)) <= new Date()
    ) {
      throw new Problem("conflict", "导入批次已过期或已确认。", 409);
    }
    const rows = await this.sql<DbRow[]>`
      select row_number, normalized_data, errors, duplicate_application_ids
      from public.import_rows where batch_id = ${id} order by row_number
    `;
    return { batch, rows };
  }

  async markProcessing(ownerId: string, id: string) {
    const rows = await this.sql`
      update public.import_batches set status = 'processing'
      where id = ${id} and owner_id=${ownerId} and status = 'previewed' and expires_at > now()
      returning id
    `;
    if (!rows.length)
      throw new Problem("conflict", "导入批次已过期或正在处理。", 409);
  }

  async recordResult(
    ownerId: string,
    id: string,
    row: ImportResultRow,
    decision: "import" | "skip",
  ) {
    await this.sql`
      update public.import_rows set decision = ${decision}, result = ${row.result}::import_row_result,
        application_id = ${row.applicationId}::uuid
      where batch_id = ${id} and row_number = ${row.rowNumber} and exists(select 1 from import_batches b where b.id=${id} and b.owner_id=${ownerId})
    `;
  }

  async complete(ownerId: string, id: string) {
    await this.sql`
      update public.import_batches set status = 'completed', completed_at = now() where id = ${id} and owner_id=${ownerId}
    `;
  }
}
