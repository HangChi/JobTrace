import { createServerDatabase } from "@/shared/database";
import { Problem } from "@/shared/errors/problem";
import { dateOnly } from "@/shared/date/date-only";
import { decodeCursor, encodeCursor } from "@/shared/pagination/cursor";
import type { InterviewRepository } from "../application/ports";
import type { InterviewListQuery } from "../application/list-query";
import type { PublicInterviewListQuery } from "../application/public-list-query";
import type {
  InterviewDetail,
  InterviewPage,
  InterviewSummary,
  PublicInterviewDetail,
  PublicInterviewPage,
  PublicInterviewSummary,
} from "../application/contracts";
import type {
  CreateInterviewInput,
  UpdateInterviewInput,
} from "../domain/interview.schema";

type Row = Record<string, unknown>;

function mapSummary(row: Row): InterviewSummary {
  return {
    id: String(row.id),
    applicationId: String(row.applicationId),
    stageOccurrenceId: row.stageOccurrenceId
      ? String(row.stageOccurrenceId)
      : null,
    companyName: String(row.companyName),
    positionName: String(row.positionName),
    stage: (row.displayStage ?? row.stageSnapshot) as never,
    interviewedOn: dateOnly(row.interviewedOn),
    status: row.status as never,
    roundResult: row.roundResult as never,
    linked: Boolean(row.stageOccurrenceId),
    questionCount: Number(row.questionCount ?? 0),
    actionCount: Number(row.actionCount ?? 0),
    visibility: (row.visibility ?? "private") as never,
    authorMode: (row.authorMode ?? "anonymous") as never,
    publishedAt: row.publishedAt ? String(row.publishedAt) : null,
  };
}

function mapPublicSummary(row: Row): PublicInterviewSummary {
  return {
    id: String(row.id),
    companyName: String(row.companyName),
    positionName: String(row.positionName),
    stage: (row.displayStage ?? row.stageSnapshot) as never,
    interviewedOn: dateOnly(row.interviewedOn),
    publishedAt: String(row.publishedAt),
    questionCount: Number(row.questionCount ?? 0),
    author:
      row.authorMode === "attributed"
        ? {
            username: String(row.authorUsername),
            image: row.authorImage ? String(row.authorImage) : null,
          }
        : null,
  };
}

export class PostgresInterviewRepository implements InterviewRepository {
  private sql = createServerDatabase();

  async create(ownerId: string, input: CreateInterviewInput) {
    try {
      const [row] = await this.sql<Row[]>`
        select * from public.create_interview_review_for_owner(
          ${ownerId},${input.applicationId},${input.stageOccurrenceId ?? null},
          ${input.stage ?? null}::recruitment_stage,${input.interviewedOn ?? null}::date,
          ${this.sql.json(input)}::jsonb
        )
      `;
      return this.get(ownerId, String(row.id)) as Promise<InterviewDetail>;
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "23505")
        throw new Problem("conflict", "该阶段已经记录过面经。", 409);
      if (code === "P0002")
        throw new Problem("not_found", "没有找到对应的投递或阶段。", 404);
      if (code === "22023")
        throw new Problem(
          "validation",
          (error as { message?: string }).message === "terminal_application"
            ? "Offer 或拒绝后的投递不能再记录新的面试。"
            : "面试阶段或日期无效。",
          400,
        );
      throw new Problem("storage", "创建面经失败，请稍后重试。", 500);
    }
  }

  async get(ownerId: string, id: string) {
    const [row] = await this.sql<Row[]>`
      select r.*,a.company_name,a.position_name,
        coalesce(s.stage,r.stage_snapshot) as display_stage,
        (select count(*) from interview_questions q where q.interview_review_id=r.id) question_count,
        (select count(*) from interview_action_items i where i.interview_review_id=r.id) action_count
      from interview_reviews r join applications a on a.id=r.application_id
      left join application_stage_occurrences s on s.id=r.stage_occurrence_id
      where r.id=${id} and r.owner_id=${ownerId}
    `;
    if (!row) return null;
    const [questions, actionItems] = await Promise.all([
      this.sql<
        Row[]
      >`select * from interview_questions where interview_review_id=${id} order by sort_order`,
      this.sql<
        Row[]
      >`select * from interview_action_items where interview_review_id=${id} order by sort_order`,
    ]);
    return {
      ...mapSummary(row),
      format: row.format as never,
      durationMinutes:
        row.durationMinutes === null ? null : Number(row.durationMinutes),
      interviewerNotes: row.interviewerNotes as string | null,
      highlights: row.highlights as string | null,
      gaps: row.gaps as string | null,
      version: Number(row.version),
      questions: questions.map((item) => ({
        id: String(item.id),
        category: item.category as never,
        question: String(item.question),
        originalAnswer: item.originalAnswer as string | null,
        followUpNotes: item.followUpNotes as string | null,
        improvedAnswer: item.improvedAnswer as string | null,
        selfRating: item.selfRating === null ? null : Number(item.selfRating),
      })),
      actionItems: actionItems.map((item) => ({
        id: String(item.id),
        content: String(item.content),
        completed: Boolean(item.completed),
      })),
      createdAt: String(row.createdAt),
      updatedAt: String(row.updatedAt),
    } as InterviewDetail;
  }

  async update(ownerId: string, id: string, input: UpdateInterviewInput) {
    try {
      await this.sql`select public.update_interview_review_for_owner(
        ${ownerId},${id},${input.version},${this.sql.json(input)}::jsonb
      )`;
      return this.get(ownerId, id) as Promise<InterviewDetail>;
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "40001")
        throw new Problem(
          "conflict",
          "面经已在其他页面更新，请刷新后重试。",
          409,
        );
      if (code === "P0002")
        throw new Problem("not_found", "没有找到这篇面经。", 404);
      if (code === "23514")
        throw new Problem(
          "validation",
          (error as { message?: string }).message ===
            "review_publish_incomplete"
            ? "请先完成复盘，再公开面经。"
            : "请先填写面经内容，再完成复盘。",
          400,
        );
      if (code === "22023")
        throw new Problem("validation", "面试 / 测评日期无效。", 400);
      throw new Problem("storage", "保存面经失败，请稍后重试。", 500);
    }
  }

  async delete(ownerId: string, id: string) {
    const rows = await this
      .sql`delete from interview_reviews where id=${id} and owner_id=${ownerId} returning id`;
    return rows.length > 0;
  }

  async list(
    ownerId: string,
    query: InterviewListQuery,
  ): Promise<InterviewPage> {
    const cursor = query.cursor ? decodeCursor(query.cursor) : undefined;
    const filters = this.sql`
      r.owner_id=${ownerId}
        ${query.applicationId ? this.sql`and r.application_id=${query.applicationId}` : this.sql``}
        ${query.q ? this.sql`and (lower(a.company_name||' '||a.position_name) like ${`%${query.q.toLowerCase()}%`} or exists(select 1 from interview_questions q where q.interview_review_id=r.id and lower(q.question) like ${`%${query.q.toLowerCase()}%`}))` : this.sql``}
        ${query.status.length ? this.sql`and r.status=any(${query.status}::review_status[])` : this.sql``}
        ${query.stage.length ? this.sql`and coalesce(s.stage,r.stage_snapshot)=any(${query.stage}::recruitment_stage[])` : this.sql``}
        ${query.result.length ? this.sql`and r.round_result=any(${query.result}::round_result[])` : this.sql``}
        ${query.interviewedFrom ? this.sql`and r.interviewed_on>=${query.interviewedFrom}::date` : this.sql``}
        ${query.interviewedTo ? this.sql`and r.interviewed_on<=${query.interviewedTo}::date` : this.sql``}
        ${
          query.publication.length
            ? this.sql`and (
          (${query.publication.includes("private")} and r.visibility='private')
          or (${query.publication.includes("anonymous")} and r.visibility='public' and r.author_mode='anonymous')
          or (${query.publication.includes("attributed")} and r.visibility='public' and r.author_mode='attributed')
        )`
            : this.sql``
        }
    `;
    const rows = await this.sql<Row[]>`
      select selected.*, totals.total_count,
        counts.question_count, counts.action_count
      from (
        select count(*)::int as total_count
        from interview_reviews r
        join applications a on a.id=r.application_id
        left join application_stage_occurrences s on s.id=r.stage_occurrence_id
        where ${filters}
      ) totals
      left join lateral (
        select r.*,a.company_name,a.position_name,
          coalesce(s.stage,r.stage_snapshot) as display_stage
        from interview_reviews r
        join applications a on a.id=r.application_id
        left join application_stage_occurrences s on s.id=r.stage_occurrence_id
        where ${filters}
          ${cursor ? this.sql`and (r.interviewed_on,r.id)<(${cursor.value}::date,${cursor.id}::uuid)` : this.sql``}
        order by r.interviewed_on desc,r.id desc
        limit ${query.limit + 1}
      ) selected on true
      left join lateral (
        select
          (select count(*)::int from interview_questions q where q.interview_review_id=selected.id) question_count,
          (select count(*)::int from interview_action_items i where i.interview_review_id=selected.id) action_count
      ) counts on selected.id is not null
      order by selected.interviewed_on desc,selected.id desc
    `;
    const dataRows = rows.filter((row) => row.id);
    const items = dataRows.slice(0, query.limit).map(mapSummary);
    const last = dataRows[query.limit - 1];
    return {
      items,
      total: Number(rows[0]?.totalCount ?? 0),
      limit: query.limit,
      nextCursor:
        dataRows.length > query.limit && last
          ? encodeCursor({
              value: dateOnly(last.interviewedOn),
              id: String(last.id),
            })
          : null,
    };
  }

  async listForApplication(ownerId: string, applicationId: string) {
    const rows = await this.sql<Row[]>`
      select r.id,r.stage_occurrence_id,r.stage_snapshot,r.interviewed_on,r.status,
        coalesce(s.stage,r.stage_snapshot) as display_stage,
        (select count(*) from interview_questions q where q.interview_review_id=r.id) question_count
      from interview_reviews r join applications a on a.id=r.application_id
      left join application_stage_occurrences s on s.id=r.stage_occurrence_id
      where r.owner_id=${ownerId} and r.application_id=${applicationId} and a.owner_id=${ownerId}
      order by r.interviewed_on desc,r.id desc
    `;
    return rows.map((item) => ({
      id: String(item.id),
      stage: (item.displayStage ?? item.stageSnapshot) as never,
      interviewedOn: dateOnly(item.interviewedOn),
      status: item.status as never,
      questionCount: Number(item.questionCount ?? 0),
      stageOccurrenceId: item.stageOccurrenceId
        ? String(item.stageOccurrenceId)
        : null,
    }));
  }

  async listPublic(
    query: PublicInterviewListQuery,
  ): Promise<PublicInterviewPage> {
    const cursor = query.cursor ? decodeCursor(query.cursor) : undefined;
    const filters = this.sql`
      r.visibility='public' and r.status='completed' and r.published_at is not null
      ${
        query.q
          ? this.sql`and (
        lower(a.company_name||' '||a.position_name) like ${`%${query.q.toLowerCase()}%`}
        or exists(select 1 from interview_questions q where q.interview_review_id=r.id and lower(q.question) like ${`%${query.q.toLowerCase()}%`})
      )`
          : this.sql``
      }
      ${query.stage.length ? this.sql`and coalesce(s.stage,r.stage_snapshot)=any(${query.stage}::recruitment_stage[])` : this.sql``}
      ${query.interviewedFrom ? this.sql`and r.interviewed_on>=${query.interviewedFrom}::date` : this.sql``}
      ${query.interviewedTo ? this.sql`and r.interviewed_on<=${query.interviewedTo}::date` : this.sql``}
    `;
    const rows = await this.sql<Row[]>`
      select selected.*,totals.total_count,
        (select count(*)::int from interview_questions q where q.interview_review_id=selected.id) question_count
      from (
        select count(*)::int total_count
        from interview_reviews r
        join applications a on a.id=r.application_id
        left join application_stage_occurrences s on s.id=r.stage_occurrence_id
        where ${filters}
      ) totals
      left join lateral (
        select r.id,r.stage_snapshot,r.interviewed_on,r.published_at,r.author_mode,
          a.company_name,a.position_name,coalesce(s.stage,r.stage_snapshot) display_stage,
          u.username author_username,u.image author_image
        from interview_reviews r
        join applications a on a.id=r.application_id
        left join application_stage_occurrences s on s.id=r.stage_occurrence_id
        left join users u on u.id=r.owner_id and r.author_mode='attributed'
        where ${filters}
          ${cursor ? this.sql`and (r.published_at,r.id)<(${cursor.value}::timestamptz,${cursor.id}::uuid)` : this.sql``}
        order by r.published_at desc,r.id desc
        limit ${query.limit + 1}
      ) selected on true
      order by selected.published_at desc,selected.id desc
    `;
    const dataRows = rows.filter((row) => row.id);
    const items = dataRows.slice(0, query.limit).map(mapPublicSummary);
    const last = dataRows[query.limit - 1];
    return {
      items,
      total: Number(rows[0]?.totalCount ?? 0),
      limit: query.limit,
      nextCursor:
        dataRows.length > query.limit && last
          ? encodeCursor({
              value: String(last.publishedAt),
              id: String(last.id),
            })
          : null,
    };
  }

  async getPublic(id: string): Promise<PublicInterviewDetail | null> {
    const [row] = await this.sql<Row[]>`
      select r.id,r.stage_snapshot,r.interviewed_on,r.published_at,r.author_mode,
        r.highlights,r.gaps,a.company_name,a.position_name,
        coalesce(s.stage,r.stage_snapshot) display_stage,
        u.username author_username,u.image author_image,
        (select count(*)::int from interview_questions q where q.interview_review_id=r.id) question_count
      from interview_reviews r
      join applications a on a.id=r.application_id
      left join application_stage_occurrences s on s.id=r.stage_occurrence_id
      left join users u on u.id=r.owner_id and r.author_mode='attributed'
      where r.id=${id} and r.visibility='public' and r.status='completed'
        and r.published_at is not null
    `;
    if (!row) return null;
    const questions = await this.sql<Row[]>`
      select category,question,original_answer,follow_up_notes,improved_answer
      from interview_questions where interview_review_id=${id} order by sort_order
    `;
    return {
      ...mapPublicSummary(row),
      highlights: row.highlights as string | null,
      gaps: row.gaps as string | null,
      questions: questions.map((question) => ({
        category: question.category as never,
        question: String(question.question),
        originalAnswer: question.originalAnswer as string | null,
        followUpNotes: question.followUpNotes as string | null,
        improvedAnswer: question.improvedAnswer as string | null,
      })),
    };
  }
}
