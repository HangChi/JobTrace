import { expect, test } from "@playwright/test";

test("foreign import batch UUID is hidden", async ({ request }) => {
  const response = await request.post(
    "/api/imports/00000000-0000-0000-0000-000000000000/confirm",
    { data: { decisions: [] } },
  );
  expect(response.status()).toBe(404);
  expect(await response.json()).toMatchObject({ code: "not_found" });
});
