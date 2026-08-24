import { expect, test } from "@playwright/test";
import { testDatabase } from "../setup/database";

test("admin console authorization, discovery, detail, access change and audit journey", async ({
  browser,
  page,
  playwright,
  request,
}) => {
  const sql = testDatabase();
  await sql`update users set role='user',disabled=false where username='playwright_user'`;
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 10);
  const adminAccount = {
    username: `journey_admin_${suffix}`,
    password: "AdminJourney123!",
  };
  const targetAccount = {
    username: `journey_target_${suffix}`,
    password: "AdminJourney123!",
  };
  for (const account of [adminAccount, targetAccount]) {
    expect(
      (
        await request.post("/api/auth/register", {
          data: account,
          headers: {
            "x-forwarded-for": `198.51.100.${account === adminAccount ? 181 : 182}`,
          },
        })
      ).status(),
    ).toBe(202);
  }
  const [admin] = await sql<{ id: string }[]>`
    select id from users where username=${adminAccount.username}`;
  const [target] = await sql<{ id: string }[]>`
    select id from users where username=${targetAccount.username}`;
  await sql`update users set role='admin' where id=${admin.id}`;

  const guest = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const guestPage = await guest.newPage();
  await guestPage.goto("/admin");
  await expect(guestPage).toHaveURL(/\/login/);
  await guest.close();

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/$/);

  const adminRequest = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:3004",
    extraHTTPHeaders: {
      origin: "http://127.0.0.1:3004",
      "x-forwarded-for": "198.51.100.183",
    },
  });
  expect(
    (
      await adminRequest.post("/api/auth/login", { data: adminAccount })
    ).status(),
  ).toBe(200);
  const adminContext = await browser.newContext({
    storageState: await adminRequest.storageState(),
  });
  const adminPage = await adminContext.newPage();
  await adminPage.goto("/admin");
  await expect(
    adminPage.getByRole("heading", { name: "运营概览" }),
  ).toBeVisible();
  await expect(adminPage.getByText(/Asia\/Shanghai/)).toBeVisible();

  await adminPage.goto(`/admin/users?q=${targetAccount.username}`);
  await expect(adminPage.getByText("共 1 个匹配用户")).toBeVisible();
  await adminPage.getByRole("link", { name: "查看详情" }).click();
  await expect(
    adminPage.getByRole("heading", {
      level: 1,
      name: targetAccount.username,
    }),
  ).toBeVisible();
  await adminPage.getByRole("button", { name: "提升为管理员" }).click();
  await adminPage
    .getByLabel("操作原因（10–500 字）")
    .fill("端到端旅程依据批准记录提升该用户为管理员。");
  const [changed] = await Promise.all([
    adminPage.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/admin/users/${target.id}`) &&
        response.request().method() === "PATCH",
    ),
    adminPage.getByRole("button", { name: "确认操作" }).click(),
  ]);
  expect(changed.status()).toBe(200);

  await adminPage.goto(`/admin/audit?target=${target.id}`);
  await expect(
    adminPage.getByRole("heading", { name: "操作审计" }),
  ).toBeVisible();
  await expect(adminPage.getByText("提升为管理员")).toBeVisible();
  await expect(
    adminPage.getByText("端到端旅程依据批准记录提升该用户为管理员。"),
  ).toBeVisible();

  await Promise.all([adminRequest.dispose(), adminContext.close(), sql.end()]);
});
