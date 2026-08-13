import { createServerDatabase } from "@/shared/database";
import { businessToday } from "@/shared/date/business-date";
import type { AnalyticsSummary } from "../application/contracts";

export async function fetchAnalyticsSummary(): Promise<AnalyticsSummary> {
  const sql = createServerDatabase();
  const [summary] = await sql<Record<string, unknown>[]>`
    select public.analytics_summary(${businessToday()}::date) as value
  `;
  const value = summary.value as Omit<AnalyticsSummary, "followUps">;
  const followUps = await sql<Record<string, unknown>[]>`
    select id, company_name, position_name, city, job_url, applied_date,
      status, latest_date, version,
      (${businessToday()}::date - latest_date) as follow_up_days
    from public.applications
    where status not in ('rejected', 'accepted', 'withdrawn', 'offer')
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
