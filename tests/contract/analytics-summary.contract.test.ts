import { expect, test } from "@playwright/test";

test("统计摘要契约", async ({ request }) => {
  const response = await request.get("/api/analytics/summary");
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({
    total: expect.any(Number),
    submitted: expect.any(Number),
    refused: expect.any(Number),
    offers: expect.any(Number),
    addedThisWeek: expect.any(Number),
    stageDistribution: expect.any(Object),
    followUps: expect.any(Array),
    progressReminders: expect.any(Array),
  });
});

test("求职分析报告契约", async ({ request }) => {
  const response = await request.get("/api/analytics/report?period=90d");
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({
    query: { period: "90d", granularity: "week" },
    availableCities: expect.any(Array),
    metrics: {
      applications: expect.any(Object),
      interviewRate: expect.any(Object),
      offerRate: expect.any(Object),
      medianDaysToFirstInterview: expect.any(Object),
      reviewCompletionRate: expect.any(Object),
    },
    trend: expect.any(Array),
    milestones: expect.any(Array),
    stageReach: expect.any(Array),
    typeBreakdown: expect.any(Array),
    cityBreakdown: expect.any(Array),
    interviews: expect.any(Object),
    summary: expect.any(Array),
    dataQuality: expect.any(Array),
  });
});
