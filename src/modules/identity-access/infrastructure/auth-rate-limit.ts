import "server-only";
import { Problem } from "@/shared/errors/problem";
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
export function checkAuthRateLimit(key: string, limit = 10, windowMs = 60_000) {
  const now = Date.now(),
    current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (current.count >= limit)
    throw new Problem("rate_limited", "尝试次数过多，请稍后再试。", 429);
  current.count += 1;
}

export function resetAuthRateLimits() {
  buckets.clear();
}
