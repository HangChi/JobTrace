import { afterEach, beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  actor: vi.fn(),
  issue: vi.fn(() => "signed-assertion"),
  legacy: vi.fn(),
  log: vi.fn(),
}));

vi.mock(
  "@/modules/identity-access/infrastructure/identity-bridge-actor.server",
  () => ({ getIdentityBridgeActor: mocks.actor }),
);
vi.mock(
  "@/modules/identity-access/infrastructure/identity-bridge.server",
  () => ({ issueIdentityBridgeAssertion: mocks.issue }),
);
vi.mock("@/modules/analytics/application/get-summary", () => ({
  getAnalyticsSummaryForOwner: mocks.legacy,
}));
vi.mock("@/shared/observability/logger", () => ({
  logServerEvent: mocks.log,
}));

import {
  readJavaAnalyticsCanary,
  shouldRouteAnalyticsToJava,
} from "@/modules/analytics/infrastructure/java-summary-bridge.server";

const summary = {
  total: 1,
  submitted: 1,
  refused: 0,
  offers: 0,
  addedThisWeek: 1,
  stageDistribution: {},
  followUps: [],
  progressReminders: [],
};

beforeEach(() => {
  vi.stubEnv("ANALYTICS_JAVA_CANARY_ENABLED", "true");
  vi.stubEnv("ANALYTICS_JAVA_CANARY_PERCENT", "100");
  vi.stubEnv("ANALYTICS_JAVA_BASE_URL", "http://java.internal:8080");
  vi.stubEnv("ANALYTICS_JAVA_TIMEOUT_MS", "500");
  mocks.actor.mockResolvedValue({
    id: "owner-a",
    role: "user",
    accessVersion: 3,
  });
  mocks.legacy.mockResolvedValue(summary);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

test("remains disabled by default for immediate rollback", () => {
  vi.stubEnv("ANALYTICS_JAVA_CANARY_ENABLED", "false");
  expect(shouldRouteAnalyticsToJava("request-a")).toBe(false);
});

test("routes a bounded deterministic canary", () => {
  vi.stubEnv("ANALYTICS_JAVA_CANARY_PERCENT", "100");
  expect(shouldRouteAnalyticsToJava("request-a")).toBe(true);
  vi.stubEnv("ANALYTICS_JAVA_CANARY_PERCENT", "0");
  expect(shouldRouteAnalyticsToJava("request-a")).toBe(false);
});

test("returns Java only when ordered JSON values match legacy", async () => {
  const candidate = structuredClone(summary);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify(candidate), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ),
  );

  await expect(readJavaAnalyticsCanary("request-a")).resolves.toEqual(
    candidate,
  );
  expect(fetch).toHaveBeenCalledWith(
    new URL("http://java.internal:8080/api/analytics/summary"),
    expect.objectContaining({
      method: "GET",
      headers: expect.objectContaining({
        authorization: "JobTraceBridge signed-assertion",
        "x-request-id": "request-a",
      }),
    }),
  );
  expect(mocks.log).toHaveBeenCalledWith(
    "analytics_java_canary_match",
    expect.not.objectContaining({ body: expect.anything() }),
  );
});

test.each([
  ["mismatch", new Response(JSON.stringify({ ...summary, total: 2 }))],
  ["status", new Response("unavailable", { status: 503 })],
])("falls back to legacy on Java %s", async (_name, response) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
  await expect(readJavaAnalyticsCanary("request-a")).resolves.toEqual(summary);
  expect(mocks.log).toHaveBeenCalledWith(
    "analytics_java_canary_fallback",
    expect.objectContaining({ requestId: "request-a" }),
  );
});

test("falls back to legacy on timeout without logging assertion or body", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));

  await expect(readJavaAnalyticsCanary("request-a")).resolves.toEqual(summary);
  const [, context] = mocks.log.mock.calls.at(-1)!;
  expect(context).not.toHaveProperty("token");
  expect(context).not.toHaveProperty("body");
  expect(JSON.stringify(context)).not.toContain("signed-assertion");
});
