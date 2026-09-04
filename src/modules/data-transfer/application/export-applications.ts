import { createServerDatabase } from "@/shared/database";
import { Problem } from "@/shared/errors/problem";
import { rowsToCsv, rowsToXlsx } from "../infrastructure/spreadsheet-writer";
import { requireUser } from "@/modules/identity-access";
import {
  STATUS_LABELS,
  STAGE_LABELS,
  TYPE_LABELS,
  type ApplicationStatus,
  type ApplicationType,
  type RecruitmentStage,
} from "@/modules/applications/domain/catalog";

export type ExportOptions = {
  scope: "all" | "filtered" | "selected";
  format: "csv" | "xlsx";
  ids: string[];
  q?: string;
  status: string[];
  type: string[];
  stage: string[];
  city: string[];
  appliedFrom?: string;
  appliedTo?: string;
};

export async function exportApplications(options: ExportOptions) {
  const actor = await requireUser();
  const sql = createServerDatabase();
  const data = await sql<Record<string, unknown>[]>`
    select application.*,
      coalesce((
        select jsonb_agg(jsonb_build_object('stage',occurrence.stage,'occurredOn',occurrence.occurred_on)
          order by occurrence.occurred_on,occurrence.created_at,occurrence.id)
        from public.application_stage_occurrences occurrence
        where occurrence.application_id=application.id
      ),'[]'::jsonb) as stage_history
    from public.applications application
    where application.owner_id=${actor.id}
      ${options.scope === "selected" ? sql`and application.id = any(${options.ids}::uuid[])` : sql``}
      ${options.scope === "filtered" && options.q ? sql`and lower(application.company_name || ' ' || application.position_name) like ${`%${options.q.toLowerCase()}%`}` : sql``}
      ${options.scope === "filtered" && options.status.length ? sql`and application.status = any(${options.status}::application_status[])` : sql``}
      ${options.scope === "filtered" && options.type.length ? sql`and application.type = any(${options.type}::application_type[])` : sql``}
      ${options.scope === "filtered" && options.stage.length ? sql`and exists(select 1 from public.application_stage_occurrences filtered_stage where filtered_stage.application_id=application.id and filtered_stage.stage=any(${options.stage}::recruitment_stage[]))` : sql``}
      ${options.scope === "filtered" && options.city.length ? sql`and application.city = any(${options.city})` : sql``}
      ${options.scope === "filtered" && options.appliedFrom ? sql`and application.applied_date >= ${options.appliedFrom}::date` : sql``}
      ${options.scope === "filtered" && options.appliedTo ? sql`and application.applied_date <= ${options.appliedTo}::date` : sql``}
    order by application.applied_date desc, application.id
  `;
  if (!data.length)
    throw new Problem("not_found", "所选范围内没有可导出的记录。", 404);
  const dateOnly = (value: unknown) =>
    value instanceof Date
      ? value.toISOString().slice(0, 10)
      : String(value).slice(0, 10);
  const timestamp = (value: unknown) => new Date(String(value)).toISOString();
  const rows = data.map((row) => ({
    ID: row.id,
    公司: row.companyName,
    岗位: row.positionName,
    城市: row.city ?? "",
    职位链接: row.jobUrl ?? "",
    投递日期: dateOnly(row.appliedDate),
    类型: TYPE_LABELS[row.type as ApplicationType],
    状态: STATUS_LABELS[row.status as ApplicationStatus],
    最新日期: dateOnly(row.latestDate),
    阶段历史: ((row.stageHistory ?? []) as Array<Record<string, unknown>>)
      .map((occurrence) => {
        const stage = occurrence.stage as RecruitmentStage;
        return `${stage}/${STAGE_LABELS[stage]} + ${dateOnly(occurrence.occurredOn)}`;
      })
      .join("；"),
    备注: row.notes ?? "",
    创建时间: timestamp(row.createdAt),
    更新时间: timestamp(row.updatedAt),
  }));
  return options.format === "xlsx"
    ? await rowsToXlsx(rows, { hyperlinkColumns: ["职位链接"] })
    : rowsToCsv(rows);
}
