import "server-only";

import { createHash } from "node:crypto";
import { createServerDatabase } from "@/shared/database";
import { Problem } from "@/shared/errors/problem";

export function clientRateLimitKey(request: Request, fallback: string) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0];
  const candidate = forwarded ?? request.headers.get("x-real-ip") ?? fallback;
  return candidate.trim().slice(0, 200) || fallback;
}

export async function checkAuthRateLimit(
  key: string,
  action: "login" | "register" | "password-reset",
  limit = 10,
  windowMs = 60_000,
) {
  const sql = createServerDatabase();
  const keyHash = createHash("sha256").update(key).digest("hex");
  const [row] = await sql<{ allowed: boolean }[]>`
    select public.consume_auth_rate_limit(
      ${keyHash},${action},${limit},${Math.ceil(windowMs / 1000)}
    ) as allowed
  `;
  if (!row?.allowed)
    throw new Problem("rate_limited", "尝试次数过多，请稍后再试。", 429);
}
