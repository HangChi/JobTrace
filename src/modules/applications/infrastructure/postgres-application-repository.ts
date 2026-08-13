import { createServerDatabase } from "@/shared/database";
import { Problem } from "@/shared/errors/problem";
import { decodeCursor, encodeCursor } from "@/shared/pagination/cursor";
import type { ApplicationRepository } from "../application/ports";
import type {
  ApplicationDetail,
  ApplicationPage,
  ApplicationSummary,
} from "../application/contracts";
import type {
  CreateApplicationInput,
  UpdateApplicationInput,
} from "../domain/application.schema";
import type { ListQuery } from "../application/list-query";
import { FOLLOW_UP_THRESHOLD_DAYS } from "../domain/catalog";

type DbRecord = Record<string, unknown>;

function dateOnly(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function mapSummary(row: DbRecord): ApplicationSummary {
  const latest = dateOnly(row.latestDate);
  const applicationDays = Math.max(
    0,
    Math.floor(
      (Date.now() - new Date(`${latest}T00:00:00+08:00`).getTime()) / 86400000,
    ),
  );
  const timelineLatest = row.timelineLatestDate
    ? dateOnly(row.timelineLatestDate)
    : null;
  const timelineDays = timelineLatest
    ? Math.max(
        0,
        Math.floor(
          (Date.now() -
            new Date(`${timelineLatest}T00:00:00+08:00`).getTime()) /
            86400000,
        ),
      )
    : 0;
  const active = String(row.status) === "submitted";
  const applicationStale =
    active && applicationDays >= FOLLOW_UP_THRESHOLD_DAYS;
  const timelineStale = active && timelineDays >= FOLLOW_UP_THRESHOLD_DAYS;
  const followUpReason = timelineStale
    ? "timeline"
    : applicationStale
      ? "application"
      : null;
  return {
    id: String(row.id),
    companyName: String(row.companyName),
    positionName: String(row.positionName),
    city: row.city as string | null,
    jobUrl: row.jobUrl as string | null,
    appliedDate: dateOnly(row.appliedDate),
    status: row.status as never,
    latestDate: latest,
    stages: (row.stages ?? []) as never[],
    needsFollowUp: Boolean(followUpReason),
    followUpDays:
      followUpReason === "timeline" ? timelineDays : applicationDays,
    followUpReason,
    version: Number(row.version),
  };
}

export class PostgresApplicationRepository implements ApplicationRepository {
  private sql = createServerDatabase();

  async create(ownerId: string, input: CreateApplicationInput) {
    const [row] = await this.sql<DbRecord[]>`
      select * from public.create_application_for_owner(${ownerId},${this.sql.json(input)}::jsonb)
    `;
    return this.get(ownerId, String(row.id)) as Promise<ApplicationDetail>;
  }

  async get(ownerId: string, id: string) {
    const [row] = await this.sql<DbRecord[]>`
      select a.*, max(s.occurred_on) as timeline_latest_date,
        coalesce(array_agg(distinct s.stage) filter (where s.stage is not null), '{}') as stages
      from public.applications a
      left join public.application_stage_occurrences s on s.application_id = a.id
      where a.id = ${id} and a.owner_id = ${ownerId}
      group by a.id
    `;
    if (!row) return null;
    const stages = await this.sql<DbRecord[]>`
      select id, stage, occurred_on from public.application_stage_occurrences
      where application_id = ${id} and exists(select 1 from applications a where a.id=${id} and a.owner_id=${ownerId}) order by occurred_on, created_at
    `;
    const events = await this.sql<DbRecord[]>`
      select id, type, occurred_on, before, after, created_at
      from public.application_events where application_id = ${id} and exists(select 1 from applications a where a.id=${id} and a.owner_id=${ownerId})
      order by occurred_on desc, created_at desc
    `;
    return {
      ...mapSummary(row),
      notes: row.notes as string | null,
      stageOccurrences: stages.map((item) => ({
        id: String(item.id),
        stage: item.stage as never,
        occurredOn: dateOnly(item.occurredOn),
      })),
      events: events.map((event) => ({
        id: String(event.id),
        type: String(event.type),
        occurredOn: dateOnly(event.occurredOn),
        before: event.before,
        after: event.after,
        createdAt: String(event.createdAt),
      })),
      createdAt: String(row.createdAt),
      updatedAt: String(row.updatedAt),
    } as ApplicationDetail;
  }

  async update(ownerId: string, id: string, input: UpdateApplicationInput) {
    try {
      await this.sql`select public.assert_application_owner(${ownerId},${id})`;
      const [row] = await this.sql<DbRecord[]>`
        select * from public.update_application(
          ${id}, ${input.version}, ${input.changeDate}::date,
          ${this.sql.json(input)}::jsonb
        )
      `;
      return this.get(ownerId, String(row.id)) as Promise<ApplicationDetail>;
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "40001") {
        throw new Problem("conflict", "记录已被更新，请刷新后重试。", 409);
      }
      if (code === "P0002") {
        throw new Problem("not_found", "没有找到这条投递记录。", 404);
      }
      throw new Problem("storage", "更新投递失败", 500);
    }
  }

  async delete(ownerId: string, id: string) {
    const rows = await this
      .sql`delete from public.applications where id = ${id} and owner_id=${ownerId} returning id`;
    return rows.length > 0;
  }

  async addStage(
    ownerId: string,
    id: string,
    stage: string,
    occurredOn: string,
  ) {
    try {
      await this.sql`select public.assert_application_owner(${ownerId},${id})`;
      await this.sql`
        select public.add_stage_occurrence(
          ${id}, ${stage}::recruitment_stage, ${occurredOn}::date
        )
      `;
      return this.get(ownerId, id) as Promise<ApplicationDetail>;
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        throw new Problem("conflict", "该阶段日期已经存在。", 409);
      }
      throw new Problem("storage", "添加阶段失败", 500);
    }
  }

  async removeStage(
    ownerId: string,
    id: string,
    occurrenceId: string,
    changeDate: string,
  ) {
    try {
      await this.sql`select public.assert_application_owner(${ownerId},${id})`;
      await this.sql`
        select public.remove_stage_occurrence(${occurrenceId}, ${changeDate}::date)
      `;
      return this.get(ownerId, id) as Promise<ApplicationDetail>;
    } catch (error) {
      if ((error as { code?: string }).code === "P0002") {
        throw new Problem("not_found", "没有找到该阶段记录。", 404);
      }
      throw new Problem("storage", "删除阶段失败", 500);
    }
  }

  async list(ownerId: string, query: ListQuery): Promise<ApplicationPage> {
    const sortColumn = {
      company: "company_name",
      position: "position_name",
      appliedDate: "applied_date",
      latestDate: "latest_date",
    }[query.sort];
    const cursor = query.cursor ? decodeCursor(query.cursor) : undefined;
    const offset = cursor ? 0 : (query.page - 1) * query.limit;
    const rows = await this.sql<DbRecord[]>`
      select a.*, count(*) over() as total_count,
        max(s.occurred_on) as timeline_latest_date,
        coalesce(array_agg(distinct s.stage) filter (where s.stage is not null), '{}') as stages
      from public.applications a
      left join public.application_stage_occurrences s on s.application_id = a.id
      where a.owner_id = ${ownerId}
        ${query.q ? this.sql`and lower(a.company_name || ' ' || a.position_name) like ${`%${query.q.toLowerCase()}%`}` : this.sql``}
        ${query.status.length ? this.sql`and a.status = any(${query.status}::application_status[])` : this.sql``}
        ${query.stage.length ? this.sql`and exists (select 1 from public.application_stage_occurrences fs where fs.application_id = a.id and fs.stage = any(${query.stage}::recruitment_stage[]))` : this.sql``}
        ${query.city.length ? this.sql`and a.city = any(${query.city})` : this.sql``}
        ${query.appliedFrom ? this.sql`and a.applied_date >= ${query.appliedFrom}::date` : this.sql``}
        ${query.appliedTo ? this.sql`and a.applied_date <= ${query.appliedTo}::date` : this.sql``}
        ${cursor ? this.sql`and (${this.sql(sortColumn)}, a.id) ${query.direction === "asc" ? this.sql`>` : this.sql`<`} (${cursor.value}, ${cursor.id}::uuid)` : this.sql``}
      group by a.id
      order by ${this.sql(sortColumn)} ${query.direction === "asc" ? this.sql`asc` : this.sql`desc`}, a.id ${query.direction === "asc" ? this.sql`asc` : this.sql`desc`}
      limit ${query.limit + 1}
      offset ${offset}
    `;
    const items = rows.slice(0, query.limit).map(mapSummary);
    const last = rows[query.limit - 1];
    return {
      items,
      total: Number(rows[0]?.totalCount ?? 0),
      page: query.page,
      limit: query.limit,
      nextCursor:
        rows.length > query.limit && last
          ? encodeCursor({
              value: String(
                last[
                  sortColumn.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
                ],
              ),
              id: String(last.id),
            })
          : null,
    };
  }
}
