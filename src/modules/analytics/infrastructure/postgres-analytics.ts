import { createServerDatabase } from "@/shared/database";
import { businessToday } from "@/shared/date/business-date";
import {
  RECRUITMENT_STAGES,
  type RecruitmentStage,
} from "@/modules/applications/domain/catalog";
import type { AnalyticsSummary } from "../application/contracts";
import { FOLLOW_UP_THRESHOLD_DAYS } from "@/modules/applications/domain/catalog";

export async function fetchAnalyticsSummary(
  ownerId: string,
): Promise<AnalyticsSummary> {
  const sql = createServerDatabase();
  const summaryQuery = sql<Record<string, unknown>[]>`
    select count(*)::int as total,
      count(*) filter(where status='submitted')::int as submitted,
      count(*) filter(where status='refused')::int as refused,
      count(*) filter(where status='offer')::int as offers,
      count(*) filter(where applied_date>=date_trunc('week',${businessToday()}::date)::date)::int as added_this_week
    from applications where owner_id=${ownerId}
  `;
  const stageRowsQuery = sql<Record<string, unknown>[]>`
    select s.stage::text as stage, count(distinct s.application_id)::int as total
    from public.application_stage_occurrences s
    join public.applications a on a.id=s.application_id
    where a.owner_id=${ownerId}
    group by s.stage
  `;
  const progressRemindersQuery = sql<Record<string, unknown>[]>`
    select
      a.id as application_id,
      a.company_name,
      a.position_name,
      a.city,
      latest_stage.id as stage_occurrence_id,
      latest_stage.stage::text as stage,
      latest_stage.occurred_on,
      review.id as review_id,
      review.status::text as review_status,
      completion.id is not null as completed
    from public.applications a
    join lateral (
      select s.id, s.stage, s.occurred_on, s.created_at
      from public.application_stage_occurrences s
      where s.application_id = a.id
      order by s.occurred_on desc, s.created_at desc, s.id desc
      limit 1
    ) latest_stage on true
    left join public.interview_reviews review
      on review.stage_occurrence_id = latest_stage.id
      and review.owner_id = a.owner_id
    left join public.progress_reminder_completions completion
      on completion.stage_occurrence_id = latest_stage.id
      and completion.owner_id = a.owner_id
    where a.owner_id=${ownerId}
      and a.status='submitted'
      and completion.id is null
      and (
        latest_stage.stage in ('assessment', 'written_test')
        or (
          latest_stage.stage in (
            'interview_1', 'interview_2', 'interview_3',
            'hr_interview', 'final_interview'
          )
          and coalesce(review.status::text, 'draft') <> 'completed'
        )
      )
    order by latest_stage.occurred_on desc, a.id
    limit 20
  `;
  const followUpsQuery = sql<Record<string, unknown>[]>`
    select a.id, a.company_name, a.position_name, a.city, a.job_url,
      a.applied_date, a.type, a.status, a.latest_date, a.version,
      case
        when timeline.latest_date is not null
          and ${businessToday()}::date - timeline.latest_date >= ${FOLLOW_UP_THRESHOLD_DAYS}
          then 'timeline'
        else 'application'
      end as follow_up_reason,
      case
        when timeline.latest_date is not null
          and ${businessToday()}::date - timeline.latest_date >= ${FOLLOW_UP_THRESHOLD_DAYS}
          then ${businessToday()}::date - timeline.latest_date
        else ${businessToday()}::date - a.latest_date
      end as follow_up_days
    from public.applications a
    left join lateral (
      select max(s.occurred_on) as latest_date
      from public.application_stage_occurrences s
      where s.application_id = a.id
    ) timeline on true
    where a.owner_id=${ownerId} and a.status='submitted'
      and (
        ${businessToday()}::date - a.latest_date >= ${FOLLOW_UP_THRESHOLD_DAYS}
        or (
          timeline.latest_date is not null
          and ${businessToday()}::date - timeline.latest_date >= ${FOLLOW_UP_THRESHOLD_DAYS}
        )
      )
    order by follow_up_days desc, a.id
    limit 20
  `;
  const [[summary], stageRows, progressReminders, followUps] =
    await Promise.all([
      summaryQuery,
      stageRowsQuery,
      progressRemindersQuery,
      followUpsQuery,
    ]);
  const stageDistribution: Partial<Record<RecruitmentStage, number>> = {};
  for (const row of stageRows) {
    const stage = String(row.stage);
    if (RECRUITMENT_STAGES.includes(stage as RecruitmentStage)) {
      stageDistribution[stage as RecruitmentStage] = Number(row.total);
    }
  }
  return {
    total: Number(summary.total),
    submitted: Number(summary.submitted),
    refused: Number(summary.refused),
    offers: Number(summary.offers),
    addedThisWeek: Number(summary.addedThisWeek),
    stageDistribution,
    progressReminders: progressReminders.map((row) => ({
      id: String(row.stageOccurrenceId),
      applicationId: String(row.applicationId),
      companyName: String(row.companyName),
      positionName: String(row.positionName),
      city: row.city as string | null,
      stageOccurrenceId: String(row.stageOccurrenceId),
      stage: row.stage as never,
      occurredOn:
        row.occurredOn instanceof Date
          ? row.occurredOn.toISOString().slice(0, 10)
          : String(row.occurredOn).slice(0, 10),
      reviewId: row.reviewId ? String(row.reviewId) : null,
      reviewStatus: row.reviewStatus as never,
      completed: Boolean(row.completed),
    })),
    followUps: followUps.map((row) => ({
      id: String(row.id),
      companyName: String(row.companyName),
      positionName: String(row.positionName),
      city: row.city as string | null,
      jobUrl: row.jobUrl as string | null,
      appliedDate:
        row.appliedDate instanceof Date
          ? row.appliedDate.toISOString().slice(0, 10)
          : String(row.appliedDate).slice(0, 10),
      type: row.type as never,
      status: row.status as never,
      latestDate:
        row.latestDate instanceof Date
          ? row.latestDate.toISOString().slice(0, 10)
          : String(row.latestDate).slice(0, 10),
      stages: [],
      needsFollowUp: true,
      followUpDays: Number(row.followUpDays),
      followUpReason: row.followUpReason as "timeline" | "application",
      version: Number(row.version),
    })),
  };
}
