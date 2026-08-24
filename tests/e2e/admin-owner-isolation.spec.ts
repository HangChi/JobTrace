import { expect, test } from "@playwright/test";
import { testDatabase } from "../setup/database";

test("admin dashboard, analytics and export remain scoped to the admin owner", async ({
  browser,
  playwright,
  baseURL,
}) => {
  const sql = testDatabase();
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
  const adminCredentials = {
    username: `owner_admin_${suffix}`,
    password: "OwnerPass123!",
  };
  const userCredentials = {
    username: `owner_user_${suffix}`,
    password: "OwnerPass123!",
  };
  const admin = await playwright.request.newContext({
    baseURL,
    extraHTTPHeaders: {
      origin: baseURL!,
      "x-forwarded-for": "198.51.100.20",
    },
  });
  const user = await playwright.request.newContext({
    baseURL,
    extraHTTPHeaders: {
      origin: baseURL!,
      "x-forwarded-for": "198.51.100.21",
    },
  });
  expect(
    (
      await admin.post("/api/auth/register", { data: adminCredentials })
    ).status(),
  ).toBe(202);
  expect(
    (await user.post("/api/auth/register", { data: userCredentials })).status(),
  ).toBe(202);
  const [adminRow] = await sql<
    { id: string }[]
  >`select id from users where username=${adminCredentials.username}`;
  await sql`update users set role='admin' where id=${adminRow.id}`;
  expect(
    (await admin.post("/api/auth/login", { data: adminCredentials })).status(),
  ).toBe(200);
  expect(
    (await user.post("/api/auth/login", { data: userCredentials })).status(),
  ).toBe(200);

  const adminApplication = await (
    await admin.post("/api/applications", {
      data: {
        companyName: "Admin Owner Only",
        positionName: "Administrator",
        appliedDate: "2026-08-14",
        status: "submitted",
      },
    })
  ).json();
  const userApplication = await (
    await user.post("/api/applications", {
      data: {
        companyName: "Other User Secret",
        positionName: "Engineer",
        appliedDate: "2026-08-14",
        status: "offer",
      },
    })
  ).json();

  const list = await (await admin.get("/api/applications")).json();
  expect(list.items.map((item: { id: string }) => item.id)).toContain(
    adminApplication.id,
  );
  expect(list.items.map((item: { id: string }) => item.id)).not.toContain(
    userApplication.id,
  );
  expect(
    (await admin.get(`/api/applications/${userApplication.id}`)).status(),
  ).toBe(404);
  expect(
    await (await admin.get("/api/analytics/summary")).json(),
  ).toMatchObject({
    total: 1,
    submitted: 1,
    offers: 0,
  });
  const exported = await (
    await admin.get("/api/exports/applications?format=csv&scope=all")
  ).text();
  expect(exported).toContain("Admin Owner Only");
  expect(exported).not.toContain("Other User Secret");
  const globalSummary = await (await admin.get("/api/admin/summary")).json();
  expect(globalSummary.counts.value.applications).toBeGreaterThanOrEqual(2);

  const browserContext = await browser.newContext({
    storageState: await admin.storageState(),
  });
  const page = await browserContext.newPage();
  await page.goto("/");
  await expect(
    page.getByText("Admin Owner Only", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Other User Secret", { exact: true }),
  ).toHaveCount(0);

  await Promise.all([
    browserContext.close(),
    admin.dispose(),
    user.dispose(),
    sql.end(),
  ]);
});
