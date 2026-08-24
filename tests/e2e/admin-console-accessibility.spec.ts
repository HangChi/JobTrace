import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { testDatabase } from "../setup/database";

test("admin pages are responsive, keyboard reachable and WCAG AA clean", async ({
  page,
}) => {
  const sql = testDatabase();
  await sql`update users set role='admin' where username='playwright_user'`;
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ["/admin", "/admin/users", "/admin/audit"]) {
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      const accessibility = await new AxeBuilder({ page }).analyze();
      expect(accessibility.violations).toEqual([]);
    }
  }

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/admin/users?q=playwright_user");
  await page.getByRole("link", { name: "查看详情" }).click();
  const trigger = page.getByRole("button", { name: "禁用账号" });
  await trigger.focus();
  await trigger.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page
      .getByRole("dialog")
      .evaluate((dialog) => dialog.contains(document.activeElement)),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await sql.end();
});
