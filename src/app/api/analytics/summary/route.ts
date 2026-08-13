import { getAnalyticsSummary } from "@/modules/analytics";
import { problemResponse } from "@/shared/http/problem-response";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return Response.json(await getAnalyticsSummary(), {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return problemResponse(error);
  }
}
