import {
  listCompanyCandidates,
  runWechatCollection,
} from "@/modules/job-market/application/wechat-intake-service";
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
        ? await getJobMarketJob("wechat_collect", jobId)
        : await listCompanyCandidates(
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
    const jobId = await startJobMarketJob("wechat_collect", (report) =>
      runWechatCollection(body, report),
    );
    return Response.json(
      { jobId },
      { status: 202, headers: { "x-request-id": requestId } },
    );
  } catch (error) {
    return problemResponse(error, requestId);
  }
}
