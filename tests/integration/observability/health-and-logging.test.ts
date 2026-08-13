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
