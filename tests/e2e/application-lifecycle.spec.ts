import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("新增、编辑阶段并删除投递", async ({ page }) => {
  await page.goto("/applications/new");
  await page.getByLabel("公司名称 *").fill("E2E 生命周期公司");
  await page.getByLabel("岗位名称 *").fill("测试工程师");
  await page.getByLabel("投递日期 *").fill("2026-08-13");
  await page.getByRole("button", { name: "保存投递" }).click();
  await expect(
    page.getByRole("heading", { name: "E2E 生命周期公司" }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "阶段", exact: true })
    .selectOption("screening");
  await page.getByLabel("发生日期").fill("2026-08-13");
  await page.getByRole("button", { name: "添加阶段" }).click();
  await expect(page.getByText("简历筛选 · 2026-08-13").first()).toBeVisible();
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
  await page.getByRole("button", { name: "删除记录" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "确认删除" }).click();
  await expect(page).toHaveURL("/");
});
