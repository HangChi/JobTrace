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
  UpdateApplicationStatusInput,
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
    type: row.type as never,
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
    const applicationId = await this.sql.begin(async (tx) => {
      let linkedPost:
        | {
            id: string;
            title: string;
            companyName: string;
            location: string | null;
            applyUrl: string | null;
            sourceId: string | null;
            externalJobId: string | null;
            status: string;
          }
        | undefined;
      if (input.jobMarketPostId) {
        const [existing] = await tx<Array<{ applicationId: string }>>`
          select application_id as "applicationId" from application_job_market_links
          where owner_id=${ownerId} and post_id=${input.jobMarketPostId}`;
        if (existing)
          throw new Problem(
            "job_market_application_exists",
            "你已经记录过这个岗位。",
            409,
            undefined,
            { existingApplicationId: existing.applicationId },
          );
        [linkedPost] = await tx<Array<NonNullable<typeof linkedPost>>>`
          select post.id,post.title,company.canonical_name as "companyName",post.primary_apply_url as "applyUrl",post.status::text,
            source_record.source_id as "sourceId",source_record.external_job_id as "externalJobId",
            (select string_agg(location.display_name,'、' order by location.display_name) from job_market_post_locations pl join job_market_locations location on location.id=pl.location_id where pl.post_id=post.id) as location
          from job_market_posts post join job_market_companies company on company.id=post.company_id
          left join lateral(select record.* from job_market_source_records record join job_market_sources source on source.id=record.source_id where record.post_id=post.id order by source.is_official desc,record.last_seen_at desc limit 1) source_record on true
          where post.id=${input.jobMarketPostId}`;
        if (!linkedPost || linkedPost.status !== "open")
          throw new Problem(
            "job_market_post_unavailable",
            "该公共岗位已失效或不存在。",
            409,
          );
      }
      const createInput = linkedPost
        ? {
            ...input,
            companyName: linkedPost.companyName,
            positionName: linkedPost.title,
            city: linkedPost.location,
            jobUrl: linkedPost.applyUrl,
          }
        : input;
      const [row] = await tx<DbRecord[]>`
        select * from public.create_application_for_owner(${ownerId},${tx.json(createInput)}::jsonb)`;
      if (linkedPost) {
        await tx`insert into application_job_market_links(application_id,owner_id,post_id,source_id,external_job_id,job_title_snapshot,company_name_snapshot,location_snapshot,apply_url_snapshot)
          values(${String(row.id)},${ownerId},${linkedPost.id},${linkedPost.sourceId},${linkedPost.externalJobId},${linkedPost.title},${linkedPost.companyName},${linkedPost.location},${linkedPost.applyUrl})`;
      }
      return String(row.id);
    });
    return this.get(ownerId, applicationId) as Promise<ApplicationDetail>;
  }

  async get(ownerId: string, id: string) {
    return this.getWithEventHistory(ownerId, id, true);
  }

  async getOverview(ownerId: string, id: string) {
    return this.getWithEventHistory(ownerId, id, false);
  }

  private async getWithEventHistory(
    ownerId: string,
    id: string,
    includeEventHistory: boolean,
  ) {
    const [row] = await this.sql<DbRecord[]>`
      select
        a.*,
        max(s.occurred_on) as timeline_latest_date,
        coalesce(
          array_agg(distinct s.stage) filter (where s.stage is not null),
          '{}'
        ) as stages,
        coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', stage_row.id,
                'stage', stage_row.stage,
                'occurredOn', stage_row.occurred_on
              )
              order by stage_row.occurred_on, stage_row.created_at
            )
            from public.application_stage_occurrences stage_row
            where stage_row.application_id = a.id
          ),
          '[]'::jsonb
        ) as stage_occurrences,
        coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', event_row.id,
                'type', event_row.type,
                'occurredOn', event_row.occurred_on,
                'before', event_row.before,
                'after', event_row.after,
                'createdAt', event_row.created_at
              )
              order by event_row.occurred_on desc, event_row.created_at desc
            )
            from (
              select event_source.*
              from public.application_events event_source
              where event_source.application_id = a.id
                ${includeEventHistory ? this.sql`` : this.sql`and event_source.type = 'status_changed' and event_source.after->>'status' = a.status::text`}
              order by event_source.occurred_on desc, event_source.created_at desc
              ${includeEventHistory ? this.sql`` : this.sql`limit 1`}
            ) event_row
          ),
          '[]'::jsonb
        ) as events
      from public.applications a
      left join public.application_stage_occurrences s on s.application_id = a.id
      where a.id = ${id} and a.owner_id = ${ownerId}
      group by a.id
    `;
    if (!row) return null;
    const stageOccurrences = Array.isArray(row.stageOccurrences)
      ? (row.stageOccurrences as DbRecord[])
      : [];
    const events = Array.isArray(row.events) ? (row.events as DbRecord[]) : [];
    return {
      ...mapSummary(row),
      notes: row.notes as string | null,
      stageOccurrences: stageOccurrences.map((item) => ({
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
      const [row] = await this.sql<DbRecord[]>`
        select * from public.update_application_for_owner(
          ${ownerId}, ${id}, ${input.version}, ${input.changeDate}::date,
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

  async updateStatus(
    ownerId: string,
    id: string,
    input: UpdateApplicationStatusInput,
    changeDate: string,
  ) {
    try {
      const [row] = await this.sql<DbRecord[]>`
        select * from public.update_application_for_owner(
          ${ownerId}, ${id}, ${input.version}, ${changeDate}::date,
          ${this.sql.json({ status: input.status })}::jsonb
        )
      `;
      return {
        id: String(row.id),
        status: row.status as never,
        latestDate: dateOnly(row.latestDate),
        version: Number(row.version),
      };
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "40001") {
        throw new Problem("conflict", "记录已被更新，请刷新后重试。", 409);
      }
      if (code === "P0002") {
        throw new Problem("not_found", "没有找到这条投递记录。", 404);
      }
      throw new Problem("storage", "更新投递状态失败", 500);
    }
  }

  async delete(ownerId: string, id: string) {
    const rows = await this
      .sql`delete from public.applications where id = ${id} and owner_id=${ownerId} returning id`;
    return rows.length > 0;
  }

  async deleteMany(ownerId: string, ids: string[]) {
    const rows = await this.sql`
      delete from public.applications
      where owner_id=${ownerId} and id=any(${ids}::uuid[])
      returning id
    `;
    return rows.length;
  }

  async addStage(
    ownerId: string,
    id: string,
    stage: string,
    occurredOn: string,
  ) {
    try {
      await this.sql`
        select public.add_stage_occurrence_for_owner(
          ${ownerId}, ${id}, ${stage}::recruitment_stage, ${occurredOn}::date
        )
      `;
      return this.get(ownerId, id) as Promise<ApplicationDetail>;
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        throw new Problem(
          "conflict",
          "该招聘阶段已经记录过，不能重复添加。",
          409,
        );
      }
      if ((error as { code?: string }).code === "P0002") {
        throw new Problem("not_found", "没有找到这条投递记录。", 404);
      }
      if ((error as { code?: string }).code === "22023") {
        const message = String((error as { message?: unknown }).message ?? "");
        if (message.includes("terminal_application")) {
          throw new Problem(
            "validation",
            "Offer 或拒绝后的投递不能再添加招聘阶段。",
            400,
          );
        }
        if (message.includes("invalid_stage_date")) {
          throw new Problem(
            "validation",
            "阶段日期不能早于投递日期或晚于今天。",
            400,
          );
        }
        throw new Problem("validation", "阶段日期无效。", 400);
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
      await this.sql`
        select public.remove_stage_occurrence_for_owner(${ownerId}, ${occurrenceId}, ${changeDate}::date)
      `;
      return this.get(ownerId, id) as Promise<ApplicationDetail>;
    } catch (error) {
      if ((error as { code?: string }).code === "P0002") {
        throw new Problem("not_found", "没有找到该阶段记录。", 404);
      }
      throw new Problem("storage", "删除阶段失败", 500);
    }
  }

  async updateStage(
    ownerId: string,
    id: string,
    occurrenceId: string,
    stage: string,
    occurredOn: string,
    changeDate: string,
  ) {
    try {
      await this.sql`select public.update_stage_occurrence_for_owner(
        ${ownerId},${id},${occurrenceId},${stage}::recruitment_stage,${occurredOn}::date,${changeDate}::date
      )`;
      return this.get(ownerId, id) as Promise<ApplicationDetail>;
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "23505")
        throw new Problem(
          "conflict",
          "该招聘阶段已经记录过，不能重复添加。",
          409,
        );
      if (code === "P0002")
        throw new Problem("not_found", "没有找到该阶段记录。", 404);
      if (code === "22023")
        throw new Problem("validation", "阶段日期无效。", 400);
      throw new Problem("storage", "更新阶段失败", 500);
    }
  }

  async list(ownerId: string, query: ListQuery): Promise<ApplicationPage> {
    const sortColumn = {
      company: "company_name",
      position: "position_name",
      appliedDate: "applied_date",
      latestDate: "latest_date",
    }[query.sort];
    const groupByStatus = query.sort === "latestDate";
    const statusRank = this.sql`
      case a.status
        when 'offer' then 0
        when 'submitted' then 1
        when 'refused' then 2
        else 1
      end
    `;
    const direction =
      query.direction === "asc" ? this.sql`asc` : this.sql`desc`;
    const cursor = query.cursor ? decodeCursor(query.cursor) : undefined;
    const offset = cursor ? 0 : (query.page - 1) * query.limit;
    const cursorCondition = cursor
      ? groupByStatus
        ? query.direction === "asc"
          ? this.sql`and (
              ${statusRank} > ${cursor.statusRank ?? 0}
              or (
                ${statusRank} = ${cursor.statusRank ?? 0}
                and (a.latest_date, a.id) > (${cursor.value}::date, ${cursor.id}::uuid)
              )
            )`
          : this.sql`and (
              ${statusRank} > ${cursor.statusRank ?? 0}
              or (
                ${statusRank} = ${cursor.statusRank ?? 0}
                and (a.latest_date, a.id) < (${cursor.value}::date, ${cursor.id}::uuid)
              )
            )`
        : this
            .sql`and (${this.sql(sortColumn)}, a.id) ${query.direction === "asc" ? this.sql`>` : this.sql`<`} (${cursor.value}, ${cursor.id}::uuid)`
      : this.sql``;
    const orderBy = groupByStatus
      ? this
          .sql`${statusRank} asc, a.latest_date ${direction}, a.id ${direction}`
      : this.sql`${this.sql(sortColumn)} ${direction}, a.id ${direction}`;
    const rows = await this.sql<DbRecord[]>`
      select a.*, count(*) over() as total_count,
        max(s.occurred_on) as timeline_latest_date,
        coalesce(array_agg(distinct s.stage) filter (where s.stage is not null), '{}') as stages
      from public.applications a
      left join public.application_stage_occurrences s on s.application_id = a.id
      where a.owner_id = ${ownerId}
        ${query.q ? this.sql`and lower(a.company_name || ' ' || a.position_name) like ${`%${query.q.toLowerCase()}%`}` : this.sql``}
        ${query.status.length ? this.sql`and a.status = any(${query.status}::application_status[])` : this.sql``}
        ${query.type.length ? this.sql`and a.type = any(${query.type}::application_type[])` : this.sql``}
        ${query.stage.length ? this.sql`and exists (select 1 from public.application_stage_occurrences fs where fs.application_id = a.id and fs.stage = any(${query.stage}::recruitment_stage[]))` : this.sql``}
        ${query.city.length ? this.sql`and a.city = any(${query.city})` : this.sql``}
        ${query.appliedFrom ? this.sql`and a.applied_date >= ${query.appliedFrom}::date` : this.sql``}
        ${query.appliedTo ? this.sql`and a.applied_date <= ${query.appliedTo}::date` : this.sql``}
        ${cursorCondition}
      group by a.id
      order by ${orderBy}
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
              ...(groupByStatus
                ? {
                    statusRank:
                      String(last.status) === "offer"
                        ? 0
                        : String(last.status) === "refused"
                          ? 2
                          : 1,
                  }
                : {}),
            })
          : null,
    };
  }
}
