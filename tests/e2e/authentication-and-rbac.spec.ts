import { expect, test } from "@playwright/test";

test("register, user routing, logout and protected admin navigation", async ({
  browser,
  playwright,
  baseURL,
}) => {
  const username = `user_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const password = "Secure-Password-123!";
  const api = await playwright.request.newContext({
    baseURL,
    extraHTTPHeaders: { origin: baseURL! },
  });
  expect(
    (
      await api.post("/api/auth/register", { data: { username, password } })
    ).status(),
  ).toBe(202);
  const login = await api.post("/api/auth/login", {
    data: { username, password },
  });
  expect(login.status()).toBe(200);
  expect(await login.json()).toMatchObject({ redirectTarget: "/" });
  const context = await browser.newContext({
    storageState: await api.storageState(),
  });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page).toHaveURL("/");
  await page.goto("/admin");
  await expect(page).toHaveURL("/");
  expect((await api.post("/api/auth/logout")).status()).toBe(204);
  await api.dispose();
  await context.close();
});
