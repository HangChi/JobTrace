import { retrySource } from "@/modules/job-market/application/source-admin-service";
import { problemResponse } from "@/shared/http/problem-response";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ sourceId: string }> },
) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  try {
    return Response.json(
      await retrySource((await params).sourceId, requestId),
      { status: 202 },
    );
  } catch (error) {
    return problemResponse(error, requestId);
  }
}
