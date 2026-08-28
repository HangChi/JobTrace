import { expect, test } from "@playwright/test";

test("统计卡、阶段文本与跟进导航", async ({ request, page }) => {
  const created: string[] = [];
  try {
    for (const input of [
      {
        companyName: "Analytics Active",
        positionName: "Engineer",
        appliedDate: "2026-07-01",
        status: "submitted",
      },
      {
        companyName: "Analytics Offer",
        positionName: "Designer",
        appliedDate: "2026-08-12",
        status: "offer",
      },
    ]) {
      const response = await request.post("/api/applications", { data: input });
      created.push((await response.json()).id);
    }
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "求职概览" })).toBeVisible();
    await expect(
      page.getByLabel("求职概览").getByText("Offer", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "阶段分布" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "需要跟进" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^查看 Analytics Active/ }),
    ).toBeVisible();
  } finally {
    for (const id of created) await request.delete(`/api/applications/${id}`);
  }
});

test("求职分析默认周期、URL 筛选与导航状态", async ({ request, page }) => {
  const created = await request.post("/api/applications", {
    data: {
      companyName: "Analytics Report",
      positionName: "Engineer",
      city: "上海",
      type: "campus_recruitment",
      appliedDate: "2026-08-10",
      status: "offer",
    },
  });
  const application = await created.json();
  try {
    await page.goto("/analytics");
    await expect(
      page.getByRole("heading", { name: "求职分析", level: 1 }),
    ).toBeVisible();
    await expect(page.locator('select[name="period"]')).toHaveValue("90d");
    await expect(page.getByRole("link", { name: "求职分析" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await page.getByLabel("求职类型").selectOption("campus_recruitment");
    await page.getByLabel("城市").selectOption("上海");
    await page.getByRole("button", { name: "应用筛选" }).click();
    await expect(page).toHaveURL(/period=90d/);
    await expect(page).toHaveURL(/type=campus_recruitment/);
    await expect(
      page.getByText("总体 Offer 率", { exact: true }),
    ).toBeVisible();
  } finally {
    await request.delete(`/api/applications/${application.id}`);
  }
});
