import { expect, test } from "@playwright/test";

test("global summary is admin-only", async ({ request }) => {
  const response = await request.get("/api/admin/summary");
  expect(response.status()).toBe(403);
  expect(await response.json()).toMatchObject({ code: "forbidden" });
});
