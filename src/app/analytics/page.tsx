import {
  getAnalyticsReport,
  parseAnalyticsReportQuery,
  resolveAnalyticsRange,
} from "@/modules/analytics";
import {
  AnalyticsReport,
  AnalyticsReportValidation,
} from "@/modules/analytics/ui/analytics-report";
import { requirePageUser } from "@/modules/identity-access";

export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;

function toSearchParams(search: Search) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (Array.isArray(value)) value.forEach((item) => params.append(key, item));
    else if (value !== undefined) params.set(key, value);
  }
  return params;
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  await requirePageUser();
  const search = await searchParams;
  const query = resolveAnalyticsRange(
    parseAnalyticsReportQuery(toSearchParams(search)),
  );
  if (query.error) {
    return <AnalyticsReportValidation query={query} cities={[]} />;
  }
  return <AnalyticsReport report={await getAnalyticsReport(query)} />;
}
