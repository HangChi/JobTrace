import "server-only";

import { getAuthEnv } from "@/shared/config/env";
import { Problem } from "@/shared/errors/problem";

export function assertSameOrigin(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") {
    throw new Problem("csrf_rejected", "请求来源无效。", 403);
  }
  const origin = request.headers.get("origin");
  if (!origin) return;
  const expected = new URL(getAuthEnv().BETTER_AUTH_URL).origin;
  if (origin !== expected) {
    throw new Problem("csrf_rejected", "请求来源无效。", 403);
  }
}

export function assertMutationRequest(
  request: Request,
  options: { maxBytes?: number } = {},
) {
  assertSameOrigin(request);
  const contentLength = request.headers.get("content-length");
  if (!contentLength) return;
  const bytes = Number(contentLength);
  if (Number.isFinite(bytes) && bytes > (options.maxBytes ?? 6 * 1024 * 1024)) {
    throw new Problem("payload_too_large", "请求内容不得超过 6MB。", 413);
  }
}
