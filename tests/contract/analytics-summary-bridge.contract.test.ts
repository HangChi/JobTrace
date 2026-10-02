import { expect, test } from "@playwright/test";

test("analytics bridge stays rollback-safe when canary is disabled", async ({
  request,
}) => {
  const requestId = "0199a55c-9b00-7000-8000-000000000001";
  const response = await request.get("/api/analytics/summary", {
    headers: { "x-request-id": requestId },
  });

  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("no-store");
  expect(response.headers()["x-request-id"]).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
  expect(response.headers()["x-request-id"]).not.toBe(requestId);
  expect(await response.json()).toMatchObject({
    total: expect.any(Number),
    stageDistribution: expect.any(Object),
    followUps: expect.any(Array),
    progressReminders: expect.any(Array),
  });
});
