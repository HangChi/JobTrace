import { format } from "date-fns";
import { createServerDatabase } from "@/shared/database";
import type { AnalyticsResolvedRange } from "../application/contracts";
import type { ReportAggregateData } from "../application/report-rules";

type DbRecord = Record<string, unknown>;
type AggregateRangeResult = {
  data: ReportAggregateData;
  availableCities: string[];
};

function dateOnly(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function records(value: unknown): DbRecord[] {
  return Array.isArray(value) ? (value as DbRecord[]) : [];
}

function field(record: DbRecord, camelName: string, snakeName = camelName) {
  return record[camelName] ?? record[snakeName];
}

async function fetchAggregateRange(
  ownerId: string,
  query: AnalyticsResolvedRange,
  from: string | undefined,
  to: string | undefined,
  includeDetails: boolean,
  includeCities: boolean,
): Promise<AggregateRangeResult> {
  const sql = createServerDatabase();
  const type = query.type ?? null;
  const city = query.city ?? "";
  const [row] = await sql<DbRecord[]>`
    with base_applications as materialized (
      select a.id, a.applied_date, a.status::text, a.type::text, coalesce(a.city, '') as city
      from public.applications a
      where a.owner_id = ${ownerId}
        and (${from ?? null}::date is null or a.applied_date >= ${from ?? null}::date)
        and (${to ?? null}::date is null or a.applied_date <= ${to ?? null}::date)
        and (${type}::text is null or a.type::text = ${type}::text)
        and (${query.hasCityFilter} = false or coalesce(a.city, '') = ${city})
    ),
    stage_facts as (
      select
        s.application_id,
        bool_or(s.stage in ('interview_1', 'interview_2', 'interview_3', 'hr_interview', 'final_interview')) as interviewed,
        bool_or(s.stage = 'final_interview') as final_interview,
        min(s.occurred_on) filter(where s.stage in ('interview_1', 'interview_2', 'interview_3', 'hr_interview', 'final_interview')) as first_interview_on,
        array_agg(distinct s.stage) as stages
      from public.application_stage_occurrences s
      join base_applications a on a.id = s.application_id
      group by s.application_id
    ),
    cohort as materialized (
      select
        a.*,
        coalesce(sf.interviewed, false) as interviewed,
        coalesce(sf.final_interview, false) as final_interview,
        sf.first_interview_on,
        coalesce(sf.stages, array[]::public.recruitment_stage[]) as stages
      from base_applications a
      left join stage_facts sf on sf.application_id = a.id
    ),
    metrics as (
      select
        count(*)::int as applications,
        count(*) filter(where interviewed)::int as interviewed,
        count(*) filter(where status = 'offer')::int as offers,
        count(*) filter(where final_interview)::int as final_interviews,
        count(*) filter(where status = 'offer' and interviewed and final_interview)::int as path_offers,
        percentile_cont(0.5) within group(order by first_interview_on - applied_date)
          filter(where first_interview_on is not null) as median_days_to_first_interview,
        count(*) filter(where status = 'offer' and not interviewed)::int as offers_without_interview,
        count(*) filter(where status = 'offer' and interviewed and not final_interview)::int as offers_without_final
      from cohort
    ),
    review_metrics as (
      select
        count(r.id)::int as total,
        count(r.id) filter(where r.status = 'completed')::int as completed,
        count(r.id) filter(where r.round_result in ('passed', 'failed'))::int as resolved,
        count(r.id) filter(where r.round_result = 'passed')::int as passed
      from cohort c
      left join public.interview_reviews r
        on r.application_id = c.id and r.owner_id = ${ownerId}
    )
    select
      to_jsonb(metrics.*) as metrics,
      to_jsonb(review_metrics.*) as review_metrics,
      case when ${includeDetails} then coalesce((
        select jsonb_agg(to_jsonb(t.*) order by t.period_start)
        from (
          select
            case when ${query.granularity} = 'week'
              then date_trunc('week', applied_date)::date
              else date_trunc('month', applied_date)::date
            end as period_start,
            count(*)::int as applications,
            count(*) filter(where interviewed)::int as interviewed,
            count(*) filter(where status = 'offer')::int as offers
          from cohort
          group by period_start
        ) t
      ), '[]'::jsonb) else '[]'::jsonb end as trend,
      case when ${includeDetails} then coalesce((
        select jsonb_agg(to_jsonb(s.*) order by s.stage)
        from (
          select stage::text, count(*)::int as count
          from cohort c cross join lateral unnest(c.stages) stage
          group by stage
        ) s
      ), '[]'::jsonb) else '[]'::jsonb end as stage_rows,
      case when ${includeDetails} then coalesce((
        select jsonb_agg(to_jsonb(d.*) order by d.key)
        from (
          select type as key, count(*)::int as applications,
            count(*) filter(where interviewed)::int as interviewed,
            count(*) filter(where status = 'offer')::int as offers
          from cohort group by type
        ) d
      ), '[]'::jsonb) else '[]'::jsonb end as type_rows,
      case when ${includeDetails} then coalesce((
        select jsonb_agg(to_jsonb(d.*) order by d.key)
        from (
          select city as key, count(*)::int as applications,
            count(*) filter(where interviewed)::int as interviewed,
            count(*) filter(where status = 'offer')::int as offers
          from cohort group by city
        ) d
      ), '[]'::jsonb) else '[]'::jsonb end as city_rows,
      case when ${includeDetails} then coalesce((
        select jsonb_agg(to_jsonb(r.*) order by r.stage)
        from (
          select reviews.stage_snapshot::text as stage, count(*)::int as total,
            count(*) filter(where reviews.round_result = 'pending')::int as pending,
            count(*) filter(where reviews.round_result = 'passed')::int as passed,
            count(*) filter(where reviews.round_result = 'failed')::int as failed
          from cohort c
          join public.interview_reviews reviews
            on reviews.application_id = c.id and reviews.owner_id = ${ownerId}
          group by reviews.stage_snapshot
        ) r
      ), '[]'::jsonb) else '[]'::jsonb end as review_stage_rows,
      case when ${includeCities} then coalesce((
        select jsonb_agg(city order by city)
        from (
          select distinct city
          from public.applications
          where owner_id = ${ownerId} and city is not null and trim(city) <> ''
        ) cities
      ), '[]'::jsonb) else '[]'::jsonb end as available_cities
    from metrics cross join review_metrics
  `;
  const metrics = row.metrics as DbRecord;
  const reviewMetrics = row.reviewMetrics as DbRecord;
  const trendRows = records(row.trend);
  const stageRows = records(row.stageRows);
  const typeRows = records(row.typeRows);
  const cityRows = records(row.cityRows);
  const reviewStageRows = records(row.reviewStageRows);

  return {
    data: {
      metrics: {
        applications: Number(field(metrics, "applications")),
        interviewed: Number(field(metrics, "interviewed")),
        offers: Number(field(metrics, "offers")),
        finalInterviews: Number(
          field(metrics, "finalInterviews", "final_interviews"),
        ),
        pathOffers: Number(field(metrics, "pathOffers", "path_offers")),
        medianDaysToFirstInterview:
          field(
            metrics,
            "medianDaysToFirstInterview",
            "median_days_to_first_interview",
          ) === null
            ? null
            : Number(
                field(
                  metrics,
                  "medianDaysToFirstInterview",
                  "median_days_to_first_interview",
                ),
              ),
        offersWithoutInterview: Number(
          field(metrics, "offersWithoutInterview", "offers_without_interview"),
        ),
        offersWithoutFinal: Number(
          field(metrics, "offersWithoutFinal", "offers_without_final"),
        ),
      },
      reviewMetrics: {
        total: Number(reviewMetrics.total),
        completed: Number(reviewMetrics.completed),
        resolved: Number(reviewMetrics.resolved),
        passed: Number(reviewMetrics.passed),
      },
      trend: trendRows.map((trendRow) => {
        const periodStart = dateOnly(
          field(trendRow, "periodStart", "period_start"),
        );
        return {
          periodStart,
          label: format(
            new Date(`${periodStart}T12:00:00Z`),
            query.granularity === "week" ? "MM/dd" : "yyyy/MM",
          ),
          applications: Number(trendRow.applications),
          interviewed: Number(trendRow.interviewed),
          offers: Number(trendRow.offers),
        };
      }),
      stageReach: stageRows.map((stageRow) => ({
        stage: stageRow.stage as never,
        count: Number(stageRow.count),
      })),
      typeBreakdown: typeRows.map((dimensionRow) => ({
        key: dimensionRow.key as never,
        applications: Number(dimensionRow.applications),
        interviewed: Number(dimensionRow.interviewed),
        offers: Number(dimensionRow.offers),
      })),
      cityBreakdown: cityRows.map((dimensionRow) => ({
        key: String(dimensionRow.key),
        applications: Number(dimensionRow.applications),
        interviewed: Number(dimensionRow.interviewed),
        offers: Number(dimensionRow.offers),
      })),
      reviewsByStage: reviewStageRows.map((stageRow) => ({
        stage: stageRow.stage as never,
        total: Number(stageRow.total),
        results: {
          pending: Number(stageRow.pending),
          passed: Number(stageRow.passed),
          failed: Number(stageRow.failed),
        },
      })),
    },
    availableCities: Array.isArray(row.availableCities)
      ? row.availableCities.map(String)
      : [],
  };
}

export async function fetchAnalyticsReportData(
  ownerId: string,
  query: AnalyticsResolvedRange,
) {
  const [current, previous] = await Promise.all([
    fetchAggregateRange(ownerId, query, query.from, query.to, true, true),
    query.comparisonFrom && query.comparisonTo
      ? fetchAggregateRange(
          ownerId,
          query,
          query.comparisonFrom,
          query.comparisonTo,
          false,
          false,
        )
      : Promise.resolve(undefined),
  ]);
  return {
    current: current.data,
    previous: previous?.data,
    availableCities: current.availableCities,
  };
}
