import { expect, test } from "@playwright/test";

test("健康检查不缓存且不泄露配置", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("no-store");
  const text = await response.text();
  expect(text).toBe('{"status":"ok"}');
  expect(text).not.toContain("DATABASE_URL");
  expect(text).not.toContain("password");
});

test("存活与就绪探针分别报告进程和依赖状态", async ({ request }) => {
  const live = await request.get("/api/health/live");
  expect(live.status()).toBe(200);
  expect(await live.json()).toEqual({ status: "ok" });

  const ready = await request.get("/api/health/ready");
  expect(ready.status()).toBe(200);
  expect(ready.headers()["cache-control"]).toBe("no-store");
  expect(ready.headers()["server-timing"]).toMatch(/^database;dur=/);
  expect(await ready.json()).toEqual({
    status: "ready",
    checks: { database: "ok", schema: "ok" },
  });
});
