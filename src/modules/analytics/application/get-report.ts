import { requireUser } from "@/modules/identity-access";
import type { AnalyticsResolvedRange } from "./contracts";
import { buildAnalyticsReportFromAggregates } from "./report-rules";
import { fetchAnalyticsReportData } from "../infrastructure/postgres-analytics-report";

export async function getAnalyticsReport(query: AnalyticsResolvedRange) {
  const actor = await requireUser();
  const data = await fetchAnalyticsReportData(actor.id, query);
  return buildAnalyticsReportFromAggregates({ query, ...data });
}
