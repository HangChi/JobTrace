import { runAtsSiteScan } from "@/modules/job-market/application/company-research-service";
import {
  getJobMarketJob,
  startJobMarketJob,
} from "@/modules/job-market/application/admin-job-service";
import { problemResponse } from "@/shared/http/problem-response";

export async function POST(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  try {
    const body = await request.json().catch(() => ({}));
    const jobId = await startJobMarketJob("ats_site_scan", (report) =>
      runAtsSiteScan(body, report),
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
        "ats_site_scan",
        new URL(request.url).searchParams.get("jobId"),
      ),
    );
  } catch (error) {
    return problemResponse(error);
  }
}
