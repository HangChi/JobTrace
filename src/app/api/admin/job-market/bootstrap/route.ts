import { initializeDefaultSourceCatalog } from "@/modules/job-market/application/source-admin-service";
import {
  getJobMarketJob,
  startJobMarketJob,
} from "@/modules/job-market/application/admin-job-service";
import { problemResponse } from "@/shared/http/problem-response";

export async function POST(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  try {
    const jobId = await startJobMarketJob("catalog_bootstrap", (report) =>
      initializeDefaultSourceCatalog(requestId, report),
    );
    return Response.json(
      { jobId },
      { status: 202, headers: { "x-request-id": requestId } },
    );
  } catch (error) {
    return problemResponse(error, requestId);
  }
}

export async function GET(request: Request) {
  try {
    return Response.json(
      await getJobMarketJob(
        "catalog_bootstrap",
        new URL(request.url).searchParams.get("jobId"),
      ),
    );
  } catch (error) {
    return problemResponse(error);
  }
}
