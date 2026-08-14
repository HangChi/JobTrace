import { expect, test } from "@playwright/test";

test("application list does not expose a foreign UUID", async ({ page }) => {
  await page.goto("/applications/00000000-0000-0000-0000-000000000000");
  await expect(page.getByRole("heading")).toBeVisible();
  await expect(page.getByText(/没有找到|不存在/)).toBeVisible();
});
