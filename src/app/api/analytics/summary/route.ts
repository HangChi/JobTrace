import { getAnalyticsSummary } from "@/modules/analytics";
import {
  readJavaAnalyticsCanary,
  shouldRouteAnalyticsToJava,
} from "@/modules/analytics/infrastructure/java-summary-bridge.server";
import { problemResponse } from "@/shared/http/problem-response";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const requestId = normalizedRequestId(request.headers.get("x-request-id"));
  try {
    const summary = shouldRouteAnalyticsToJava(requestId)
      ? await readJavaAnalyticsCanary(requestId)
      : await getAnalyticsSummary();
    return Response.json(summary, {
      headers: {
        "cache-control": "no-store",
        "x-request-id": requestId,
      },
    });
  } catch (error) {
    return problemResponse(error, requestId);
  }
}

function normalizedRequestId(candidate: string | null) {
  if (
    candidate &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      candidate,
    )
  ) {
    return candidate.toLowerCase();
  }
  return crypto.randomUUID();
}
