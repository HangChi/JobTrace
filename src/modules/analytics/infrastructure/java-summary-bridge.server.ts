import "server-only";

import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import type { AnalyticsSummary } from "../application/contracts";
import { getAnalyticsSummaryForOwner } from "../application/get-summary";
import {
  getIdentityBridgeActor,
  issueIdentityBridgeAssertion,
} from "@/modules/identity-access/server";
import { logServerEvent } from "@/shared/observability/logger";

const configSchema = z.object({
  enabled: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  percent: z.coerce.number().int().min(0).max(100).default(0),
  baseUrl: z.url().optional(),
  timeoutMs: z.coerce.number().int().min(100).max(5_000).default(1_500),
});

export function shouldRouteAnalyticsToJava(requestId: string) {
  const config = bridgeRoutingConfig();
  if (!config.enabled || !config.baseUrl || config.percent === 0) return false;
  if (config.percent === 100) return true;
  let bucket = 0;
  for (const character of requestId) {
    bucket = (bucket * 31 + character.charCodeAt(0)) % 100;
  }
  return bucket < config.percent;
}

export async function readJavaAnalyticsCanary(
  requestId: string,
): Promise<AnalyticsSummary> {
  const config = bridgeRoutingConfig();
  const actor = await getIdentityBridgeActor();
  const legacyPromise = getAnalyticsSummaryForOwner(actor.id);
  const token = issueIdentityBridgeAssertion({
    actor,
    requestId,
    method: "GET",
    path: "/api/analytics/summary",
  });
  const startedAt = performance.now();
  try {
    const response = await fetch(
      new URL("/api/analytics/summary", config.baseUrl),
      {
        method: "GET",
        cache: "no-store",
        signal: AbortSignal.timeout(config.timeoutMs),
        headers: {
          accept: "application/json",
          authorization: `JobTraceBridge ${token}`,
          "x-request-id": requestId,
        },
      },
    );
    const durationMs = Math.round(performance.now() - startedAt);
    const legacy = await legacyPromise;
    if (!response.ok) {
      logServerEvent("analytics_java_canary_fallback", {
        requestId,
        reason: "status",
        statusClass: `${Math.floor(response.status / 100)}xx`,
        durationMs,
      });
      return legacy;
    }
    const candidate = (await response.json()) as AnalyticsSummary;
    if (!isDeepStrictEqual(candidate, legacy)) {
      logServerEvent("analytics_java_canary_fallback", {
        requestId,
        reason: "contract_mismatch",
        statusClass: "2xx",
        durationMs,
      });
      return legacy;
    }
    logServerEvent("analytics_java_canary_match", {
      requestId,
      statusClass: "2xx",
      durationMs,
    });
    return candidate;
  } catch {
    logServerEvent("analytics_java_canary_fallback", {
      requestId,
      reason: "unavailable",
      durationMs: Math.round(performance.now() - startedAt),
    });
    return legacyPromise;
  }
}

function bridgeRoutingConfig() {
  return configSchema.parse({
    enabled: process.env.ANALYTICS_JAVA_CANARY_ENABLED,
    percent: process.env.ANALYTICS_JAVA_CANARY_PERCENT,
    baseUrl: process.env.ANALYTICS_JAVA_BASE_URL || undefined,
    timeoutMs: process.env.ANALYTICS_JAVA_TIMEOUT_MS,
  });
}
