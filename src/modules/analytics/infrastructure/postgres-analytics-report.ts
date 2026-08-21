import { format } from "date-fns";
import { createServerDatabase } from "@/shared/database";
import type { AnalyticsResolvedRange } from "../application/contracts";
import type { ReportAggregateData } from "../application/report-rules";

type DbRecord = Record<string, unknown>;

function dateOnly(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

async function fetchAggregateRange(
  ownerId: string,
  query: AnalyticsResolvedRange,
  from: string | undefined,
  to: string | undefined,
  includeDetails: boolean,
): Promise<ReportAggregateData> {
  const sql = createServerDatabase();
  const type = query.type ?? null;
  const city = query.city ?? "";
  const metricsQuery = sql<DbRecord[]>`
    with cohort as (
      select
        a.id,
        a.applied_date,
        a.status::text as status,
        exists(
          select 1 from public.application_stage_occurrences s
          where s.application_id = a.id and s.stage in (
            'interview_1', 'interview_2', 'interview_3',
            'hr_interview', 'final_interview'
          )
        ) as interviewed,
        exists(
          select 1 from public.application_stage_occurrences s
          where s.application_id = a.id and s.stage = 'final_interview'
        ) as final_interview,
        (
          select min(s.occurred_on)
          from public.application_stage_occurrences s
          where s.application_id = a.id and s.stage in (
            'interview_1', 'interview_2', 'interview_3',
            'hr_interview', 'final_interview'
          )
        ) as first_interview_on
      from public.applications a
      where a.owner_id = ${ownerId}
        and (${from ?? null}::date is null or a.applied_date >= ${from ?? null}::date)
        and (${to ?? null}::date is null or a.applied_date <= ${to ?? null}::date)
        and (${type}::text is null or a.type::text = ${type}::text)
        and (${query.hasCityFilter} = false or coalesce(a.city, '') = ${city})
    )
    select
      count(*)::int as applications,
      count(*) filter(where interviewed)::int as interviewed,
      count(*) filter(where status = 'offer')::int as offers,
      count(*) filter(where final_interview)::int as final_interviews,
      count(*) filter(where status = 'offer' and interviewed and final_interview)::int as path_offers,
      percentile_cont(0.5) within group(
        order by first_interview_on - applied_date
      ) filter(where first_interview_on is not null) as median_days_to_first_interview,
      count(*) filter(where status = 'offer' and not interviewed)::int as offers_without_interview,
      count(*) filter(where status = 'offer' and interviewed and not final_interview)::int as offers_without_final
    from cohort
  `;
  const reviewMetricsQuery = sql<DbRecord[]>`
    select
      count(r.id)::int as total,
      count(r.id) filter(where r.status = 'completed')::int as completed,
      count(r.id) filter(where r.round_result in ('passed', 'failed'))::int as resolved,
      count(r.id) filter(where r.round_result = 'passed')::int as passed
    from public.applications a
    left join public.interview_reviews r
      on r.application_id = a.id and r.owner_id = a.owner_id
    where a.owner_id = ${ownerId}
      and (${from ?? null}::date is null or a.applied_date >= ${from ?? null}::date)
      and (${to ?? null}::date is null or a.applied_date <= ${to ?? null}::date)
      and (${type}::text is null or a.type::text = ${type}::text)
      and (${query.hasCityFilter} = false or coalesce(a.city, '') = ${city})
  `;
  const empty = Promise.resolve([] as DbRecord[]);
  const trendQuery = includeDetails
    ? sql<DbRecord[]>`
        select
          case when ${query.granularity} = 'week'
            then date_trunc('week', a.applied_date)::date
            else date_trunc('month', a.applied_date)::date
          end as period_start,
          count(*)::int as applications,
          count(*) filter(where exists(
            select 1 from public.application_stage_occurrences s
            where s.application_id = a.id and s.stage in (
              'interview_1', 'interview_2', 'interview_3',
              'hr_interview', 'final_interview'
            )
          ))::int as interviewed,
          count(*) filter(where a.status = 'offer')::int as offers
        from public.applications a
        where a.owner_id = ${ownerId}
          and (${from ?? null}::date is null or a.applied_date >= ${from ?? null}::date)
          and (${to ?? null}::date is null or a.applied_date <= ${to ?? null}::date)
          and (${type}::text is null or a.type::text = ${type}::text)
          and (${query.hasCityFilter} = false or coalesce(a.city, '') = ${city})
        group by period_start order by period_start
      `
    : empty;
  const stageQuery = includeDetails
    ? sql<DbRecord[]>`
        select s.stage::text as stage, count(distinct a.id)::int as count
        from public.applications a
        join public.application_stage_occurrences s on s.application_id = a.id
        where a.owner_id = ${ownerId}
          and (${from ?? null}::date is null or a.applied_date >= ${from ?? null}::date)
          and (${to ?? null}::date is null or a.applied_date <= ${to ?? null}::date)
          and (${type}::text is null or a.type::text = ${type}::text)
          and (${query.hasCityFilter} = false or coalesce(a.city, '') = ${city})
        group by s.stage
      `
    : empty;
  const dimensionQuery = (dimension: "type" | "city") =>
    includeDetails
      ? sql<DbRecord[]>`
          select
            ${dimension === "type" ? sql`a.type::text` : sql`coalesce(a.city, '')`} as key,
            count(*)::int as applications,
            count(*) filter(where exists(
              select 1 from public.application_stage_occurrences s
              where s.application_id = a.id and s.stage in (
                'interview_1', 'interview_2', 'interview_3',
                'hr_interview', 'final_interview'
              )
            ))::int as interviewed,
            count(*) filter(where a.status = 'offer')::int as offers
          from public.applications a
          where a.owner_id = ${ownerId}
            and (${from ?? null}::date is null or a.applied_date >= ${from ?? null}::date)
            and (${to ?? null}::date is null or a.applied_date <= ${to ?? null}::date)
            and (${type}::text is null or a.type::text = ${type}::text)
            and (${query.hasCityFilter} = false or coalesce(a.city, '') = ${city})
          group by key
        `
      : empty;
  const reviewsByStageQuery = includeDetails
    ? sql<DbRecord[]>`
        select
          r.stage_snapshot::text as stage,
          count(*)::int as total,
          count(*) filter(where r.round_result = 'pending')::int as pending,
          count(*) filter(where r.round_result = 'passed')::int as passed,
          count(*) filter(where r.round_result = 'failed')::int as failed
        from public.interview_reviews r
        join public.applications a
          on a.id = r.application_id and a.owner_id = r.owner_id
        where r.owner_id = ${ownerId}
          and (${from ?? null}::date is null or a.applied_date >= ${from ?? null}::date)
          and (${to ?? null}::date is null or a.applied_date <= ${to ?? null}::date)
          and (${type}::text is null or a.type::text = ${type}::text)
          and (${query.hasCityFilter} = false or coalesce(a.city, '') = ${city})
        group by r.stage_snapshot
      `
    : empty;

  const [
    [metrics],
    [reviewMetrics],
    trendRows,
    stageRows,
    typeRows,
    cityRows,
    reviewStageRows,
  ] = await Promise.all([
    metricsQuery,
    reviewMetricsQuery,
    trendQuery,
    stageQuery,
    dimensionQuery("type"),
    dimensionQuery("city"),
    reviewsByStageQuery,
  ]);
  return {
    metrics: {
      applications: Number(metrics.applications),
      interviewed: Number(metrics.interviewed),
      offers: Number(metrics.offers),
      finalInterviews: Number(metrics.finalInterviews),
      pathOffers: Number(metrics.pathOffers),
      medianDaysToFirstInterview:
        metrics.medianDaysToFirstInterview === null
          ? null
          : Number(metrics.medianDaysToFirstInterview),
      offersWithoutInterview: Number(metrics.offersWithoutInterview),
      offersWithoutFinal: Number(metrics.offersWithoutFinal),
    },
    reviewMetrics: {
      total: Number(reviewMetrics.total),
      completed: Number(reviewMetrics.completed),
      resolved: Number(reviewMetrics.resolved),
      passed: Number(reviewMetrics.passed),
    },
    trend: trendRows.map((row) => {
      const periodStart = dateOnly(row.periodStart);
      return {
        periodStart,
        label: format(
          new Date(`${periodStart}T12:00:00Z`),
          query.granularity === "week" ? "MM/dd" : "yyyy/MM",
        ),
        applications: Number(row.applications),
        interviewed: Number(row.interviewed),
        offers: Number(row.offers),
      };
    }),
    stageReach: stageRows.map((row) => ({
      stage: row.stage as never,
      count: Number(row.count),
    })),
    typeBreakdown: typeRows.map((row) => ({
      key: row.key as never,
      applications: Number(row.applications),
      interviewed: Number(row.interviewed),
      offers: Number(row.offers),
    })),
    cityBreakdown: cityRows.map((row) => ({
      key: String(row.key),
      applications: Number(row.applications),
      interviewed: Number(row.interviewed),
      offers: Number(row.offers),
    })),
    reviewsByStage: reviewStageRows.map((row) => ({
      stage: row.stage as never,
      total: Number(row.total),
      results: {
        pending: Number(row.pending),
        passed: Number(row.passed),
        failed: Number(row.failed),
      },
    })),
  };
}

export async function fetchAnalyticsReportData(
  ownerId: string,
  query: AnalyticsResolvedRange,
) {
  const sql = createServerDatabase();
  const [current, previous, cityRows] = await Promise.all([
    fetchAggregateRange(ownerId, query, query.from, query.to, true),
    query.comparisonFrom && query.comparisonTo
      ? fetchAggregateRange(
          ownerId,
          query,
          query.comparisonFrom,
          query.comparisonTo,
          false,
        )
      : Promise.resolve(undefined),
    sql<DbRecord[]>`
      select distinct city
      from public.applications
      where owner_id = ${ownerId} and city is not null and trim(city) <> ''
      order by city
    `,
  ]);
  return {
    current,
    previous,
    availableCities: cityRows.map((row) => String(row.city)),
  };
}
