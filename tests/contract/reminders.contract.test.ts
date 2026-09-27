import { expect, test } from "@playwright/test";

test("reminder summary contract", async ({ request }) => {
  const response = await request.get("/api/reminders");
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({
    overdue: expect.any(Array),
    upcoming: expect.any(Array),
    history: expect.any(Array),
    email: { available: expect.any(Boolean) },
  });
});

test("reminder creation validates required fields", async ({ request }) => {
  const response = await request.post("/api/reminders", { data: {} });
  expect(response.status()).toBe(400);
  expect(await response.json()).toMatchObject({
    code: "validation",
    fieldErrors: expect.any(Array),
  });
});
