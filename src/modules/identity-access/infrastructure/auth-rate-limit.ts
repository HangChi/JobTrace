import "server-only";

import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { createServerDatabase } from "@/shared/database";
import { getAuthTrustProxyHeaders } from "@/shared/config/env";
import { Problem } from "@/shared/errors/problem";

function normalizeIpAddress(value: string) {
  const address = value.trim();
  const version = isIP(address);
  if (version === 4) return address;
  if (version !== 6) return null;
  const hostname = new URL(`http://[${address}]/`).hostname;
  return hostname.slice(1, -1);
}

export function clientRateLimitKey(headers: Headers, fallback: string) {
  if (!getAuthTrustProxyHeaders()) return fallback;
  const forwarded = headers.get("x-forwarded-for");
  if (!forwarded || forwarded.includes(",")) return fallback;
  return normalizeIpAddress(forwarded) ?? fallback;
}

export async function checkAuthRateLimit(
  key: string,
  action:
    | "login"
    | "register"
    | "password-reset"
    | "email-code-ip"
    | "email-code-address"
    | "email-code-cooldown"
    | "email-change",
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
