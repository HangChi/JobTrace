import "server-only";

import { createServerDatabase } from "@/shared/database";
import type {
  AdminAuditEvent,
  AdminManagedApplication,
  AdminManagedInterview,
  ManagedUserSummary,
  PageResult,
} from "../application/contracts";
import type {
  AccessChangeInput,
  AdminAuditQuery,
  AdminUserQuery,
} from "../application/admin-query-schema";

export async function readAdminCounts() {
  const sql = createServerDatabase();
  const [counts] = await sql<
    Array<{
      users: number;
      activeUsers: number;
      disabledUsers: number;
      administrators: number;
      applications: number;
      interviews: number;
    }>
  >`select
      (select count(*)::int from users) users,
      (select count(*)::int from users where disabled=false) active_users,
      (select count(*)::int from users where disabled=true) disabled_users,
      (select count(*)::int from users where role='admin' and disabled=false) administrators,
      (select count(*)::int from applications) applications,
      (select count(*)::int from interview_reviews) interviews`;
  return counts;
}

export async function readAdminActivity() {
  const sql = createServerDatabase();
  const [[windows], dailyTrend] = await Promise.all([
    sql<
      Array<{
        registered7d: number;
        active7d: number;
        registered30d: number;
        active30d: number;
      }>
    >`with bounds as (
        select (now() at time zone 'Asia/Shanghai')::date today
      ) select
        (select count(*)::int from users,bounds where (created_at at time zone 'Asia/Shanghai')::date >= today-6) registered_7d,
        (select count(distinct s.user_id)::int from sessions s join users u on u.id=s.user_id,bounds
          where u.disabled=false and (s.created_at at time zone 'Asia/Shanghai')::date >= today-6) active_7d,
        (select count(*)::int from users,bounds where (created_at at time zone 'Asia/Shanghai')::date >= today-29) registered_30d,
        (select count(distinct s.user_id)::int from sessions s join users u on u.id=s.user_id,bounds
          where u.disabled=false and (s.created_at at time zone 'Asia/Shanghai')::date >= today-29) active_30d`,
    sql<
      Array<{ date: string; registeredUsers: number; activeUsers: number }>
    >`with days as (
        select (now() at time zone 'Asia/Shanghai')::date-(29-day_index)::int as activity_date
        from generate_series(0,29) day_index
      ), registrations as (
        select (created_at at time zone 'Asia/Shanghai')::date activity_date,count(*)::int total
        from users
        where (created_at at time zone 'Asia/Shanghai')::date >= (now() at time zone 'Asia/Shanghai')::date-29
        group by 1
      ), activity as (
        select (s.created_at at time zone 'Asia/Shanghai')::date activity_date,count(distinct s.user_id)::int total
        from sessions s join users u on u.id=s.user_id
        where u.disabled=false and (s.created_at at time zone 'Asia/Shanghai')::date >= (now() at time zone 'Asia/Shanghai')::date-29
        group by 1
      ) select to_char(d.activity_date,'YYYY-MM-DD') date,
        coalesce(r.total,0)::int registered_users,coalesce(a.total,0)::int active_users
      from days d left join registrations r using(activity_date) left join activity a using(activity_date)
      order by d.activity_date`,
  ]);
  return { windows, dailyTrend };
}

type UserRow = {
  id: string;
  username: string | null;
  displayUsername: string | null;
  email: string;
  role: "user" | "admin";
  disabled: boolean;
  accessVersion: number;
  createdAt: Date;
  lastSignInAt: Date | null;
  applicationCount: number;
  interviewCount: number;
};

function userDto(row: UserRow): ManagedUserSummary {
  return {
    id: row.id,
    username: row.displayUsername ?? row.username ?? row.email.split("@")[0],
    internalEmail: row.email,
    role: row.role,
    disabled: row.disabled,
    accessVersion: Number(row.accessVersion),
    createdAt: row.createdAt.toISOString(),
    lastSignInAt: row.lastSignInAt?.toISOString() ?? null,
    applicationCount: Number(row.applicationCount),
    interviewCount: Number(row.interviewCount),
  };
}

function userFilter(query: AdminUserQuery) {
  return {
    pattern: query.q ? `%${query.q}%` : null,
    role: query.role === "all" ? null : query.role,
    disabled: query.status === "all" ? null : query.status === "disabled",
    from: query.registeredFrom ?? null,
    to: query.registeredTo ?? null,
  };
}

export async function readManagedUsers(
  query: AdminUserQuery,
): Promise<PageResult<ManagedUserSummary>> {
  const sql = createServerDatabase();
  const filter = userFilter(query);
  const offset = (query.page - 1) * query.limit;
  const [countRows, rows] = await Promise.all([
    sql<Array<{ total: number }>>`select count(*)::int total from users u
      where (${filter.pattern}::text is null or lower(coalesce(u.username,'') || ' ' || u.email) like lower(${filter.pattern}))
        and (${filter.role}::text is null or u.role=${filter.role})
        and (${filter.disabled}::boolean is null or u.disabled=${filter.disabled})
        and (${filter.from}::date is null or u.created_at >= (${filter.from}::date::timestamp at time zone 'Asia/Shanghai'))
        and (${filter.to}::date is null or u.created_at < ((${filter.to}::date+1)::timestamp at time zone 'Asia/Shanghai'))`,
    sql<
      UserRow[]
    >`select u.id,u.username,u.display_username,u.email,u.role,u.disabled,u.access_version,u.created_at,
        (select max(s.created_at) from sessions s where s.user_id=u.id) last_sign_in_at,
        (select count(*)::int from applications a where a.owner_id=u.id) application_count,
        (select count(*)::int from interview_reviews i where i.owner_id=u.id) interview_count
      from users u
      where (${filter.pattern}::text is null or lower(coalesce(u.username,'') || ' ' || u.email) like lower(${filter.pattern}))
        and (${filter.role}::text is null or u.role=${filter.role})
        and (${filter.disabled}::boolean is null or u.disabled=${filter.disabled})
        and (${filter.from}::date is null or u.created_at >= (${filter.from}::date::timestamp at time zone 'Asia/Shanghai'))
        and (${filter.to}::date is null or u.created_at < ((${filter.to}::date+1)::timestamp at time zone 'Asia/Shanghai'))
      order by u.created_at desc,u.id desc limit ${query.limit} offset ${offset}`,
  ]);
  const total = Number(countRows[0]?.total ?? 0);
  return {
    items: rows.map(userDto),
    total,
    page: query.page,
    limit: query.limit,
    totalPages: total ? Math.ceil(total / query.limit) : 0,
  };
}

export async function readManagedUser(userId: string) {
  const sql = createServerDatabase();
  const [row] = await sql<
    UserRow[]
  >`select u.id,u.username,u.display_username,u.email,u.role,u.disabled,u.access_version,u.created_at,
      (select max(s.created_at) from sessions s where s.user_id=u.id) last_sign_in_at,
      (select count(*)::int from applications a where a.owner_id=u.id) application_count,
      (select count(*)::int from interview_reviews i where i.owner_id=u.id) interview_count
    from users u where u.id=${userId}`;
  return row ? userDto(row) : null;
}

const contentPageSize = 10;
const dateOnly = (value: unknown) =>
  value instanceof Date
    ? value.toISOString().slice(0, 10)
    : String(value).slice(0, 10);

type ManagedApplicationRow = {
  id: string;
  companyName: string;
  positionName: string;
  city: string | null;
  jobUrl: string | null;
  type: AdminManagedApplication["type"];
  status: AdminManagedApplication["status"];
  appliedDate: Date | string;
  latestDate: Date | string;
  notes: string | null;
  stages: AdminManagedApplication["stages"];
};

export async function readManagedUserApplications(
  userId: string,
  page: number,
) {
  const sql = createServerDatabase();
  const offset = (page - 1) * contentPageSize;
  const [counts, rows] = await Promise.all([
    sql<Array<{ total: number }>>`
      select count(*)::int total from applications where owner_id=${userId}`,
    sql<ManagedApplicationRow[]>`
      select a.id,a.company_name,a.position_name,a.city,a.job_url,a.type,a.status,
        a.applied_date,a.latest_date,a.notes,
        coalesce((
          select jsonb_agg(jsonb_build_object(
            'stage',s.stage,'occurredOn',s.occurred_on
          ) order by s.occurred_on,s.created_at)
          from application_stage_occurrences s where s.application_id=a.id
        ),'[]'::jsonb) stages
      from applications a where a.owner_id=${userId}
      order by a.latest_date desc,a.id desc
      limit ${contentPageSize} offset ${offset}`,
  ]);
  const total = Number(counts[0]?.total ?? 0);
  return {
    items: rows.map((row): AdminManagedApplication => ({
      ...row,
      appliedDate: dateOnly(row.appliedDate),
      latestDate: dateOnly(row.latestDate),
      stages: row.stages.map((stage) => ({
        ...stage,
        occurredOn: dateOnly(stage.occurredOn),
      })),
    })),
    total,
    page,
    limit: contentPageSize,
    totalPages: total ? Math.ceil(total / contentPageSize) : 0,
  } satisfies PageResult<AdminManagedApplication>;
}

type ManagedInterviewRow = Omit<AdminManagedInterview, "interviewedOn"> & {
  interviewedOn: Date | string;
};

export async function readManagedUserInterviews(userId: string, page: number) {
  const sql = createServerDatabase();
  const offset = (page - 1) * contentPageSize;
  const [counts, rows] = await Promise.all([
    sql<Array<{ total: number }>>`
      select count(*)::int total from interview_reviews where owner_id=${userId}`,
    sql<ManagedInterviewRow[]>`
      select r.id,r.application_id,a.company_name,a.position_name,
        coalesce(s.stage,r.stage_snapshot)::text stage,
        coalesce(s.occurred_on,r.interviewed_on) interviewed_on,
        r.status,r.round_result,r.format,r.duration_minutes,r.interviewer_notes,
        r.highlights,r.gaps,
        coalesce((
          select jsonb_agg(jsonb_build_object(
            'category',q.category,'question',q.question,
            'originalAnswer',q.original_answer,'followUpNotes',q.follow_up_notes,
            'improvedAnswer',q.improved_answer,'selfRating',q.self_rating
          ) order by q.sort_order)
          from interview_questions q where q.interview_review_id=r.id
        ),'[]'::jsonb) questions,
        coalesce((
          select jsonb_agg(jsonb_build_object(
            'content',i.content,'completed',i.completed
          ) order by i.sort_order)
          from interview_action_items i where i.interview_review_id=r.id
        ),'[]'::jsonb) action_items
      from interview_reviews r
      join applications a on a.id=r.application_id
      left join application_stage_occurrences s on s.id=r.stage_occurrence_id
      where r.owner_id=${userId}
      order by coalesce(s.occurred_on,r.interviewed_on) desc,r.id desc
      limit ${contentPageSize} offset ${offset}`,
  ]);
  const total = Number(counts[0]?.total ?? 0);
  return {
    items: rows.map((row): AdminManagedInterview => ({
      ...row,
      interviewedOn: dateOnly(row.interviewedOn),
      durationMinutes:
        row.durationMinutes === null ? null : Number(row.durationMinutes),
      questions: row.questions.map((question) => ({
        ...question,
        selfRating:
          question.selfRating === null ? null : Number(question.selfRating),
      })),
    })),
    total,
    page,
    limit: contentPageSize,
    totalPages: total ? Math.ceil(total / contentPageSize) : 0,
  } satisfies PageResult<AdminManagedInterview>;
}

type AuditRow = {
  id: string;
  requestId: string;
  actorId: string | null;
  actorIdentifierSnapshot: string;
  targetUserId: string | null;
  targetIdentifierSnapshot: string;
  eventType: AdminAuditEvent["eventType"];
  outcome: AdminAuditEvent["outcome"];
  reason: string;
  beforeData: AdminAuditEvent["before"];
  afterData: AdminAuditEvent["after"];
  failureCode: string | null;
  createdAt: Date;
};

function auditDto(row: AuditRow): AdminAuditEvent {
  return {
    id: row.id,
    requestId: row.requestId,
    actorId: row.actorId,
    actorIdentifier: row.actorIdentifierSnapshot,
    actorDeleted: row.actorId === null,
    targetUserId: row.targetUserId,
    targetIdentifier: row.targetIdentifierSnapshot,
    targetDeleted: row.targetUserId === null,
    eventType: row.eventType,
    outcome: row.outcome,
    reason: row.reason,
    before: row.beforeData,
    after: row.afterData,
    failureCode: row.failureCode,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function readRecentAdminAudit(userId: string, limit = 10) {
  const sql = createServerDatabase();
  const rows = await sql<
    AuditRow[]
  >`select e.id,e.request_id,e.actor_id,e.actor_identifier_snapshot,
      e.target_user_id,e.target_identifier_snapshot,e.event_type,e.outcome,e.reason,
      e.before_data,e.after_data,e.failure_code,e.created_at
    from admin_audit_events e where e.target_user_id=${userId}
    order by e.created_at desc,e.id desc limit ${limit}`;
  return rows.map(auditDto);
}

export async function readAdminAuditEvents(
  query: AdminAuditQuery,
): Promise<PageResult<AdminAuditEvent>> {
  const sql = createServerDatabase();
  const actor = query.actor ? `%${query.actor}%` : null;
  const target = query.target ? `%${query.target}%` : null;
  const eventType = query.eventType === "all" ? null : query.eventType;
  const outcome = query.outcome === "all" ? null : query.outcome;
  const offset = (query.page - 1) * query.limit;
  const [counts, rows] = await Promise.all([
    sql<
      Array<{ total: number }>
    >`select count(*)::int total from admin_audit_events e
      where (${actor}::text is null or e.actor_id=${query.actor ?? null} or lower(e.actor_identifier_snapshot) like lower(${actor}))
        and (${target}::text is null or e.target_user_id=${query.target ?? null} or lower(e.target_identifier_snapshot) like lower(${target}))
        and (${eventType}::text is null or e.event_type=${eventType})
        and (${outcome}::text is null or e.outcome=${outcome})
        and (${query.occurredFrom ?? null}::date is null or e.created_at >= (${query.occurredFrom ?? null}::date::timestamp at time zone 'Asia/Shanghai'))
        and (${query.occurredTo ?? null}::date is null or e.created_at < (((${query.occurredTo ?? null}::date)+1)::timestamp at time zone 'Asia/Shanghai'))`,
    sql<
      AuditRow[]
    >`select e.id,e.request_id,e.actor_id,e.actor_identifier_snapshot,
        e.target_user_id,e.target_identifier_snapshot,e.event_type,e.outcome,e.reason,
        e.before_data,e.after_data,e.failure_code,e.created_at
      from admin_audit_events e
      where (${actor}::text is null or e.actor_id=${query.actor ?? null} or lower(e.actor_identifier_snapshot) like lower(${actor}))
        and (${target}::text is null or e.target_user_id=${query.target ?? null} or lower(e.target_identifier_snapshot) like lower(${target}))
        and (${eventType}::text is null or e.event_type=${eventType})
        and (${outcome}::text is null or e.outcome=${outcome})
        and (${query.occurredFrom ?? null}::date is null or e.created_at >= (${query.occurredFrom ?? null}::date::timestamp at time zone 'Asia/Shanghai'))
        and (${query.occurredTo ?? null}::date is null or e.created_at < (((${query.occurredTo ?? null}::date)+1)::timestamp at time zone 'Asia/Shanghai'))
      order by e.created_at desc,e.id desc limit ${query.limit} offset ${offset}`,
  ]);
  const total = Number(counts[0]?.total ?? 0);
  return {
    items: rows.map(auditDto),
    total,
    page: query.page,
    limit: query.limit,
    totalPages: total ? Math.ceil(total / query.limit) : 0,
  };
}

export type AccessChangeDatabaseResult = {
  outcome: "succeeded" | "denied" | "conflict" | "failed";
  failureCode: string | null;
  auditEventId: string;
  replayed: boolean;
  userId?: string;
  role?: "user" | "admin";
  disabled?: boolean;
  accessVersion?: number;
};

export async function writeUserAccessChange(
  actorId: string,
  targetUserId: string,
  input: AccessChangeInput,
) {
  const sql = createServerDatabase();
  const [row] = await sql<Array<{ result: AccessChangeDatabaseResult }>>`
    select public.change_user_access_as(
      ${actorId},${targetUserId},${input.requestId}::uuid,${input.expectedVersion}::bigint,
      ${input.action},${input.reason},${input.confirmSelf}
    ) result`;
  return row.result;
}
