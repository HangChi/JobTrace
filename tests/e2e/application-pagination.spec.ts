import { expect, test } from "@playwright/test";

test("点击分页立即换页，普通刷新回到第一页", async ({ request, page }) => {
  const ids: string[] = [];
  try {
    for (let index = 0; index < 11; index += 1) {
      const response = await request.post("/api/applications", {
        data: {
          companyName: `Pagination Live ${String(index).padStart(2, "0")}`,
          positionName: "分页测试工程师",
          appliedDate: "2026-08-18",
          status: "submitted",
        },
      });
      ids.push((await response.json()).id);
    }

    await page.goto("/?q=Pagination%20Live&limit=10");
    await expect(page.locator(".application-row")).toHaveCount(10);
    const actionsCell = page
      .locator('.application-row td[data-label="操作"]')
      .first();
    await expect(
      actionsCell.getByRole("button", { name: "编辑" }),
    ).toBeVisible();
    await expect(
      actionsCell.getByRole("button", { name: "删除" }),
    ).toBeVisible();
    const actionsOverflow = await actionsCell.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(actionsOverflow.scrollWidth).toBeLessThanOrEqual(
      actionsOverflow.clientWidth + 1,
    );
    await page.getByRole("link", { name: "第 2 页" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.locator(".application-row")).toHaveCount(1);

    await page.reload();
    await expect(page).not.toHaveURL(/page=2/);
    await expect(page.locator(".application-row")).toHaveCount(10);
  } finally {
    for (const id of ids) await request.delete(`/api/applications/${id}`);
  }
});
