import { expect, test } from "@playwright/test";

test("筛选、清空与空状态", async ({ request, page }) => {
  const created = await request.post("/api/applications", {
    data: {
      companyName: "E2E 筛选公司",
      positionName: "产品经理",
      appliedDate: "2026-08-13",
      status: "submitted",
    },
  });
  const application = await created.json();
  try {
    await page.goto("/");
    await page.getByLabel("搜索公司或岗位").fill("E2E 筛选公司");
    await page.getByRole("button", { name: "应用条件" }).click();
    await expect(page.getByText("E2E 筛选公司")).toBeVisible();
    await page.getByLabel("搜索公司或岗位").fill("完全不存在的公司");
    await page.getByRole("button", { name: "应用条件" }).click();
    await expect(
      page.getByRole("heading", { name: "没有符合条件的记录" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "清空条件" }).click();
    await expect(page).toHaveURL("/");
  } finally {
    await request.delete(`/api/applications/${application.id}`);
  }
});
