import { runCompanyResearchNow } from "@/modules/job-market/application/company-research-service";
import { problemResponse } from "@/shared/http/problem-response";

export async function POST(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  try {
    const body = await request.json().catch(() => ({}));
    return Response.json(await runCompanyResearchNow(body), {
      status: 202,
      headers: { "x-request-id": requestId },
    });
  } catch (error) {
    return problemResponse(error, requestId);
  }
}
