import { expect, test } from "@playwright/test";

test("统计摘要契约", async ({ request }) => {
  const response = await request.get("/api/analytics/summary");
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({
    total: expect.any(Number),
    active: expect.any(Number),
    rejected: expect.any(Number),
    offers: expect.any(Number),
    addedThisWeek: expect.any(Number),
    stageDistribution: expect.any(Object),
    followUps: expect.any(Array),
  });
});
