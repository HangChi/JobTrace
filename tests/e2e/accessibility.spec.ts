import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const route of [
  "/",
  "/applications/new",
  "/import",
  "/interviews",
  "/interviews/new",
  "/login",
  "/register",
  "/forgot-password",
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
