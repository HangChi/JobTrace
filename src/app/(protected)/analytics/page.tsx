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
import { toSearchParams } from "@/shared/url/search-params";

export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;

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
