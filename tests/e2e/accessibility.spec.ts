import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const route of [
  "/",
  "/applications/new",
  "/import",
  "/interviews",
  "/interviews/new",
  "/analytics",
  "/login",
  "/register",
  "/forgot-password",
  "/profile",
]) {
  test(`${route} 无严重可访问性问题`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(route);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const result = await new AxeBuilder({ page }).analyze();
    expect(result.violations).toEqual([]);
  });
}

test("account navigation remains keyboard usable on a narrow desktop", async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 720 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations).toEqual([]);
});

for (const width of [375, 768, 1280]) {
  test(`求职分析在 ${width}px 视口可访问且无页面横向溢出`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/analytics");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const result = await new AxeBuilder({ page }).analyze();
    expect(result.violations).toEqual([]);
  });
}

for (const route of ["/login", "/register"]) {
  for (const width of [375, 768, 1280]) {
    test(`${route} 在 ${width}px 视口可访问且无横向溢出`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        storageState: { cookies: [], origins: [] },
        viewport: { width, height: 900 },
      });
      const page = await context.newPage();
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      const result = await new AxeBuilder({ page }).analyze();
      expect(result.violations).toEqual([]);
      await context.close();
    });
  }
}

for (const width of [375, 768, 1280]) {
  test(`面经列表在 ${width}px 视口可访问且无横向溢出`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/interviews");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const result = await new AxeBuilder({ page }).analyze();
    expect(result.violations).toEqual([]);
  });
}

for (const width of [375, 768, 1280]) {
  test(`个人中心在 ${width}px 视口可访问且无横向溢出`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/profile");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const result = await new AxeBuilder({ page }).analyze();
    expect(result.violations).toEqual([]);
  });
}

test("个人中心与应用栏对齐，设置导航保持单行", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/profile");
  await expect(
    page.getByRole("heading", { name: "个人中心", level: 1 }),
  ).toBeVisible();

  const layout = await page.evaluate(() => {
    const header = document
      .querySelector(".app-header")!
      .getBoundingClientRect();
    const profile = document
      .querySelector(".profile-page")!
      .getBoundingClientRect();
    const links = [
      ...document.querySelectorAll<HTMLElement>(".profile-index a"),
    ];
    return {
      leftDifference: Math.abs(header.left - profile.left),
      rightDifference: Math.abs(header.right - profile.right),
      navigationFits: links.every(
        (link) =>
          link.scrollWidth <= link.clientWidth &&
          getComputedStyle(link).whiteSpace === "nowrap",
      ),
    };
  });

  expect(layout.leftDifference).toBeLessThanOrEqual(1);
  expect(layout.rightDifference).toBeLessThanOrEqual(1);
  expect(layout.navigationFits).toBe(true);
});

test("投递概览使用可区分的语义色", async ({ page }) => {
  await page.goto("/");
  const accents = await page
    .locator(".summary-card")
    .evaluateAll((cards) =>
      cards.map((card) => getComputedStyle(card, "::before").backgroundColor),
    );

  expect(new Set(accents).size).toBe(accents.length);
});
