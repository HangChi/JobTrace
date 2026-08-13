import { createServerDatabase } from "@/shared/database";
import { Problem } from "@/shared/errors/problem";
import { rowsToCsv, rowsToXlsx } from "../infrastructure/spreadsheet-writer";
import { requireUser } from "@/modules/identity-access";
import {
  STATUS_LABELS,
  type ApplicationStatus,
} from "@/modules/applications/domain/catalog";

export type ExportOptions = {
  scope: "all" | "filtered";
  format: "csv" | "xlsx";
  q?: string;
  status: string[];
  city: string[];
  appliedFrom?: string;
  appliedTo?: string;
};

export async function exportApplications(options: ExportOptions) {
  const actor = await requireUser();
  const sql = createServerDatabase();
  const data = await sql<Record<string, unknown>[]>`
    select company_name, position_name, city, job_url, applied_date, status, notes
    from public.applications
    where owner_id=${actor.id}
      ${options.scope === "filtered" && options.q ? sql`and lower(company_name || ' ' || position_name) like ${`%${options.q.toLowerCase()}%`}` : sql``}
      ${options.scope === "filtered" && options.status.length ? sql`and status = any(${options.status}::application_status[])` : sql``}
      ${options.scope === "filtered" && options.city.length ? sql`and city = any(${options.city})` : sql``}
      ${options.scope === "filtered" && options.appliedFrom ? sql`and applied_date >= ${options.appliedFrom}::date` : sql``}
      ${options.scope === "filtered" && options.appliedTo ? sql`and applied_date <= ${options.appliedTo}::date` : sql``}
    order by applied_date desc, id
  `;
  if (!data.length)
    throw new Problem("not_found", "所选范围内没有可导出的记录。", 404);
  const rows = data.map((row) => ({
    公司: row.companyName,
    岗位: row.positionName,
    城市: row.city ?? "",
    职位链接: row.jobUrl ?? "",
    投递日期: String(row.appliedDate),
    状态: STATUS_LABELS[row.status as ApplicationStatus],
    备注: row.notes ?? "",
  }));
  return options.format === "xlsx" ? rowsToXlsx(rows) : rowsToCsv(rows);
}
