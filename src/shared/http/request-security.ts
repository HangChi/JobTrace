import "server-only";

import { getAuthEnv } from "@/shared/config/env";
import { Problem } from "@/shared/errors/problem";

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const expected = new URL(getAuthEnv().BETTER_AUTH_URL).origin;
  if (origin !== expected) {
    throw new Problem("csrf_rejected", "请求来源无效。", 403);
  }
}
