import { initializeDefaultSources } from "@/modules/job-market/application/source-admin-service";
import { problemResponse } from "@/shared/http/problem-response";

export async function POST(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  try {
    return Response.json(await initializeDefaultSources(requestId), {
      status: 201,
      headers: { "x-request-id": requestId },
    });
  } catch (error) {
    return problemResponse(error, requestId);
  }
}
