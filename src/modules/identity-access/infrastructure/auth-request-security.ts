import "server-only";

import { getAuthEnv } from "@/shared/config/env";
import { Problem } from "@/shared/errors/problem";
export { assertSameOrigin } from "@/shared/http/request-security";

export async function verifyAuthChallenge(request: Request) {
  const env = getAuthEnv();
  if (!env.AUTH_CHALLENGE_VERIFY_URL) return;
  const token = request.headers.get("x-auth-challenge");
  if (!token) throw new Problem("challenge_required", "请完成人机验证。", 400);
  const response = await fetch(env.AUTH_CHALLENGE_VERIFY_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, secret: env.AUTH_CHALLENGE_SECRET }),
    cache: "no-store",
  });
  const result = (await response.json().catch(() => null)) as {
    success?: boolean;
  } | null;
  if (!response.ok || !result?.success) {
    throw new Problem("challenge_failed", "人机验证失败。", 403);
  }
}
