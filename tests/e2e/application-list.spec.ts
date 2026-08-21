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
    await expect(page.getByText("E2E 筛选公司", { exact: true })).toBeVisible();
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

test("全选当前页后可导出所选并批量删除", async ({ request, page }) => {
  const marker = `E2E 批量操作 ${crypto.randomUUID().slice(0, 8)}`;
  const created = await Promise.all(
    ["甲", "乙"].map(async (suffix) => {
      const response = await request.post("/api/applications", {
        data: {
          companyName: `${marker}${suffix}`,
          positionName: "批量测试岗位",
          appliedDate: "2026-08-13",
          status: "submitted",
        },
      });
      expect(response.status()).toBe(201);
      return response.json();
    }),
  );
  try {
    await page.goto(`/?q=${encodeURIComponent(marker)}`);
    await page.locator("thead").getByLabel("选择当前页全部 2 条记录").click();
    await expect(page.locator(".bulk-selection-count")).toContainText(
      "2条记录已选择",
    );
    await expect(page.getByRole("link", { name: /CSV 文件/ })).toHaveAttribute(
      "href",
      /scope=selected.*format=csv.*id=/,
    );

    await page.getByRole("button", { name: "删除所选" }).click();
    await expect(
      page.getByRole("heading", { name: "删除所选的 2 条投递？" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "确认删除 2 条" }).click();
    await expect(page.getByText("已删除 2 条投递记录。")).toBeVisible();
    await expect(page.getByText(marker + "甲", { exact: true })).toHaveCount(0);
    await expect(page.getByText(marker + "乙", { exact: true })).toHaveCount(0);
  } finally {
    await request.delete("/api/applications", {
      data: { ids: created.map((item) => item.id) },
    });
  }
});
