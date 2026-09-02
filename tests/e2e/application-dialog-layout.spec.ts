import { expect, test } from "@playwright/test";

test("新增投递弹窗在桌面视口完整展示并使用图标关闭按钮", async ({ page }) => {
  await page.goto("/applications");
  await page
    .locator(".workspace-page-header")
    .getByRole("button", { name: "新增投递" })
    .click();

  const dialog = page.getByRole("dialog", { name: "新增投递" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "关闭弹窗" })).toHaveCount(1);
  await expect(
    dialog.getByRole("button", { name: "关闭弹窗" }).locator("svg"),
  ).toHaveCount(1);

  const overflow = await dialog.locator(".dialog-card").evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(overflow.scrollHeight).toBeLessThanOrEqual(overflow.clientHeight + 1);
  await expect(dialog.getByRole("button", { name: "保存投递" })).toBeVisible();
});
