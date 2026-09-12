import { reviewCompanyCandidate } from "@/modules/job-market/application/wechat-intake-service";
import { problemResponse } from "@/shared/http/problem-response";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ candidateId: string }> },
) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  try {
    const { candidateId } = await context.params;
    const body = await request.json().catch(() => ({}));
    return Response.json(await reviewCompanyCandidate(candidateId, body), {
      headers: { "x-request-id": requestId },
    });
  } catch (error) {
    return problemResponse(error, requestId);
  }
}
