import { expect, test } from "@playwright/test";

test("个人面经筛选在桌面保持一行并在窄屏安全重排", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/interviews/mine");

  const controlTops = await page
    .locator(".personal-interview-filters")
    .evaluate((form) =>
      [...form.querySelectorAll("input, select, button, a")].map((control) =>
        Math.round(control.getBoundingClientRect().y),
      ),
    );
  expect(controlTops).toHaveLength(7);
  expect(
    Math.max(...controlTops) - Math.min(...controlTops),
  ).toBeLessThanOrEqual(1);

  await page.setViewportSize({ width: 375, height: 900 });
  await page.reload();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
