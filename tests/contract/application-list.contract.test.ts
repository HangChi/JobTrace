import { expect, test } from "@playwright/test";

test("列表搜索筛选分页契约", async ({ request }) => {
  const response = await request.get(
    "/api/applications?status=submitted&sort=latestDate&direction=desc&limit=2",
  );
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.items).toEqual(expect.any(Array));
  expect(body.total).toEqual(expect.any(Number));
  expect(body.page).toBe(1);
  expect(body.limit).toBe(2);
  expect(body.nextCursor === null || typeof body.nextCursor === "string").toBe(
    true,
  );
  for (const item of body.items)
    expect(item).toMatchObject({
      id: expect.any(String),
      companyName: expect.any(String),
      status: expect.any(String),
      version: expect.any(Number),
    });
});
