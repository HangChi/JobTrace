import { createServerDatabase } from "@/shared/database";
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
    const candidates = rows
      .filter((row) => row.data)
      .map((row) => ({
        rowNumber: row.rowNumber,
        companyName: String(row.data?.companyName),
        positionName: String(row.data?.positionName),
        appliedDate: String(row.data?.appliedDate),
      }));
    if (!candidates.length) return rows;
    const matches = await this.sql<
      { rowNumber: number; applicationIds: string[] }[]
    >`
      with candidates as (
        select *
        from jsonb_to_recordset(${this.sql.json(candidates)}::jsonb) as value(
          "rowNumber" integer,
          "companyName" text,
          "positionName" text,
          "appliedDate" date
        )
      )
      select
        candidate."rowNumber" as row_number,
        coalesce(
          array_agg(application.id order by application.id)
            filter (where application.id is not null),
          '{}'
        ) as application_ids
      from candidates candidate
      left join public.applications application
        on application.owner_id=${ownerId}
        and lower(application.company_name)=lower(candidate."companyName")
        and lower(application.position_name)=lower(candidate."positionName")
        and application.applied_date=candidate."appliedDate"
      group by candidate."rowNumber"
    `;
    const byRow = new Map(
      matches.map((match) => [Number(match.rowNumber), match.applicationIds]),
    );
    for (const row of rows)
      row.duplicateApplicationIds = byRow.get(row.rowNumber) ?? [];
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
      const values = rows.map((row) => ({
        rowNumber: row.rowNumber,
        normalizedData: row.data,
        errors: row.errors,
        duplicateApplicationIds: row.duplicateApplicationIds,
      }));
      await sql`
        insert into public.import_rows(
          batch_id, row_number, normalized_data, errors, duplicate_application_ids
        )
        select
          ${String(batch.id)}::uuid,
          value."rowNumber",
          value."normalizedData",
          value.errors,
          coalesce(
            array(
              select jsonb_array_elements_text(value."duplicateApplicationIds")::uuid
            ),
            '{}'
          )
        from jsonb_to_recordset(${sql.json(values as never)}::jsonb) as value(
          "rowNumber" integer,
          "normalizedData" jsonb,
          errors jsonb,
          "duplicateApplicationIds" jsonb
        )
      `;
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

  async confirmBatch(
    ownerId: string,
    id: string,
    decisions: { rowNumber: number; action: "import" | "skip" }[],
  ) {
    const [row] = await this.sql<{ result: ImportResultRow[] }[]>`
      select public.confirm_import_batch_for_owner(
        ${ownerId},
        ${id}::uuid,
        ${this.sql.json(decisions)}::jsonb
      ) as result
    `;
    return row?.result ?? [];
  }
}
