import {
  listSourceCandidates,
  scanSourceCandidates,
} from "@/modules/job-market/application/source-discovery-service";
import { problemResponse } from "@/shared/http/problem-response";

export async function GET(request: Request) {
  try {
    return Response.json(
      await listSourceCandidates(
        new URL(request.url).searchParams.get("status") ?? undefined,
      ),
    );
  } catch (error) {
    return problemResponse(error);
  }
}

export async function POST(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  try {
    const body = await request.json().catch(() => ({}));
    return Response.json(await scanSourceCandidates(body), {
      status: 202,
      headers: { "x-request-id": requestId },
    });
  } catch (error) {
    return problemResponse(error, requestId);
  }
}
