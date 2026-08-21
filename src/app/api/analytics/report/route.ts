import {
  getAnalyticsReport,
  parseAnalyticsReportQuery,
  resolveAnalyticsRange,
} from "@/modules/analytics";
import { Problem } from "@/shared/errors/problem";
import { problemResponse } from "@/shared/http/problem-response";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const query = resolveAnalyticsRange(
      parseAnalyticsReportQuery(new URL(request.url).searchParams),
    );
    if (query.error) throw new Problem("validation", query.error, 400);
    return Response.json(await getAnalyticsReport(query), {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return problemResponse(error);
  }
}
