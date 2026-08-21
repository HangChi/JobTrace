import { expect, test } from "@playwright/test";

test("register, user routing, logout and protected admin navigation", async ({
  browser,
  playwright,
  baseURL,
}) => {
  const username = `user_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const password = "SecurePass123!";
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

test("registration returns to the requested page through the login form", async ({
  browser,
}) => {
  const username = `flow_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const password = "FlowPass123!";
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const page = await context.newPage();

  await page.goto("/analytics");
  await expect(page).toHaveURL(/\/login\?returnTo=%2Fanalytics/);
  await expect(page.getByRole("link", { name: "忘记密码" })).not.toBeVisible();
  await page.getByRole("link", { name: "免费创建账号" }).click();
  await expect(page).toHaveURL(/\/register\?returnTo=%2Fanalytics/);

  await page.getByLabel("用户名").fill(username.toUpperCase());
  await page.getByLabel("昵称").fill("流程测试用户");
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByLabel("确认密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "创建账号" }).click();

  await expect(page).toHaveURL(/\/login\?.*registered=1/);
  await expect(page.getByText("账号创建成功")).toBeVisible();
  await expect(page.getByLabel("用户名")).toHaveValue(username);
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL("/analytics");

  await context.close();
});
