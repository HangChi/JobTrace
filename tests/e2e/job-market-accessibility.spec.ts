import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { testDatabase } from "../setup/database";

for (const width of [375, 1280]) {
  test(`recruitment marketplace is axe-clean and keyboard usable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "招聘广场" })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.getByLabel("关键词").focus();
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
}

test("job-market administration is axe-clean and keyboard reachable", async ({
  browser,
  playwright,
  baseURL,
}) => {
  const sql = testDatabase();
  const username = `a11y_admin_${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}`;
  const password = "A11yAdmin123!";
  const api = await playwright.request.newContext({
    baseURL,
    extraHTTPHeaders: {
      origin: baseURL!,
      "x-forwarded-for": "198.51.100.218",
    },
  });
  expect(
    (
      await api.post("/api/auth/register", { data: { username, password } })
    ).status(),
  ).toBe(202);
  const [admin] = await sql<Array<{ id: string }>>`
    select id from users where username=${username}`;
  await sql`update users set role='admin' where id=${admin.id}`;
  expect(
    (
      await api.post("/api/auth/login", { data: { username, password } })
    ).status(),
  ).toBe(200);
  const context = await browser.newContext({
    storageState: await api.storageState(),
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  try {
    await page.goto("/admin/job-market");
    await expect(
      page.getByRole("heading", { name: "来源与同步" }),
    ).toBeVisible();
    await page.getByLabel("企业 ID").focus();
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  } finally {
    await sql`delete from users where id=${admin.id}`;
    await Promise.all([context.close(), api.dispose(), sql.end()]);
  }
});
