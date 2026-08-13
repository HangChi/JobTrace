import { expect, test } from "@playwright/test";
import path from "node:path";

test("上传混合 CSV 并完成部分导入", async ({ page, request }) => {
  await page.goto("/import");
  await page
    .getByLabel("选择文件")
    .setInputFiles(path.resolve("tests/fixtures/import/mixed.csv"));
  await page.getByRole("button", { name: "上传并预检" }).click();
  await expect(page.getByRole("heading", { name: "预检结果" })).toBeVisible();
  await expect(page.getByText("需修正")).toBeVisible();
  await page.getByRole("button", { name: "确认所选行" }).click();
  await expect(page.getByRole("heading", { name: "导入完成" })).toBeVisible();
  const list = await request.get("/api/applications?q=导入验证混合");
  const body = await list.json();
  for (const item of body.items)
    await request.delete(`/api/applications/${item.id}`);
});
