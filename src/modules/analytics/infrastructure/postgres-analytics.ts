import { createServerDatabase } from "@/shared/database";
import { businessToday } from "@/shared/date/business-date";
import type { AnalyticsSummary } from "../application/contracts";

export async function fetchAnalyticsSummary(
  ownerId: string,
): Promise<AnalyticsSummary> {
  const sql = createServerDatabase();
  const [summary] = await sql<Record<string, unknown>[]>`
    select jsonb_build_object('total',count(*),'active',count(*) filter(where status='active'),'rejected',count(*) filter(where status='rejected'),'offers',count(*) filter(where status='offer'),'addedThisWeek',count(*) filter(where applied_date>=date_trunc('week',${businessToday()}::date)::date),'stageDistribution',coalesce((select jsonb_object_agg(stage,total) from(select stage,count(distinct s.application_id) total from application_stage_occurrences s join applications a2 on a2.id=s.application_id where a2.owner_id=${ownerId} group by stage)x),'{}'::jsonb)) as value from applications where owner_id=${ownerId}
  `;
  const value = summary.value as Omit<AnalyticsSummary, "followUps">;
  const followUps = await sql<Record<string, unknown>[]>`
    select id, company_name, position_name, city, job_url, applied_date,
      status, latest_date, version,
      (${businessToday()}::date - latest_date) as follow_up_days
    from public.applications
    where owner_id=${ownerId} and status not in ('rejected', 'accepted', 'withdrawn', 'offer')
      and ${businessToday()}::date - latest_date >= 7
    order by latest_date asc, id
    limit 20
  `;
  return {
    ...value,
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
      status: row.status as never,
      latestDate:
        row.latestDate instanceof Date
          ? row.latestDate.toISOString().slice(0, 10)
          : String(row.latestDate).slice(0, 10),
      stages: [],
      needsFollowUp: true,
      followUpDays: Number(row.followUpDays),
      version: Number(row.version),
    })),
  };
}
