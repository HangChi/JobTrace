import { timingSafeEqual } from "node:crypto";
import { getJobMarketEnv } from "@/shared/config/env";
import { Problem } from "@/shared/errors/problem";
import { problemResponse } from "@/shared/http/problem-response";
import { internalSyncSchema } from "@/modules/job-market/application/contracts";
import { synchronizeDueSources } from "@/modules/job-market/application/synchronize-due-sources";

function authorized(request: Request, secret: string | undefined) {
  const supplied =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || supplied.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(secret));
}

export async function POST(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  try {
    const env = getJobMarketEnv();
    if (!env.enabled) throw new Problem("not_found", "招聘同步未启用。", 404);
    if (!authorized(request, env.syncSecret))
      throw new Problem("unauthorized", "同步凭据无效。", 401);
    const body = await request.json().catch(() => ({}));
    const input = internalSyncSchema.parse(body);
    return Response.json(await synchronizeDueSources(input.limit, requestId), {
      headers: { "x-request-id": requestId },
    });
  } catch (error) {
    return problemResponse(error, requestId);
  }
}
