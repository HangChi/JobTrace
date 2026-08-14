import { expect, test } from "@playwright/test";

test("application API rejects unauthenticated callers", async ({
  playwright,
  baseURL,
}) => {
  const anonymous = await playwright.request.newContext({
    baseURL,
    storageState: { cookies: [], origins: [] },
  });
  const list = await anonymous.get("/api/applications", { maxRedirects: 0 });
  expect([302, 307, 401]).toContain(list.status());
  await anonymous.dispose();
});

test("unknown application is returned as not found", async ({ request }) => {
  const response = await request.get(
    "/api/applications/00000000-0000-0000-0000-000000000000",
  );
  expect(response.status()).toBe(404);
});
