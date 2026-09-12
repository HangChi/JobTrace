import {
  listSourceCandidates,
  runSourceDiscoveryScan,
} from "@/modules/job-market/application/source-discovery-service";
import {
  getJobMarketJob,
  startJobMarketJob,
} from "@/modules/job-market/application/admin-job-service";
import { problemResponse } from "@/shared/http/problem-response";

export async function GET(request: Request) {
  const jobId = new URL(request.url).searchParams.get("jobId");
  try {
    return Response.json(
      jobId
        ? await getJobMarketJob("source_discovery", jobId)
        : await listSourceCandidates(
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
    const startedJobId = await startJobMarketJob("source_discovery", (report) =>
      runSourceDiscoveryScan(body, report),
    );
    return Response.json(
      { jobId: startedJobId },
      { status: 202, headers: { "x-request-id": requestId } },
    );
  } catch (error) {
    return problemResponse(error, requestId);
  }
}
