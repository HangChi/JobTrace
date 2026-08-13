import { expect, test } from "@playwright/test";

test("统计卡、阶段文本与跟进导航", async ({ request, page }) => {
  const created: string[] = [];
  try {
    for (const input of [
      {
        companyName: "Analytics Active",
        positionName: "Engineer",
        appliedDate: "2026-08-01",
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
    await expect(page.getByText("Offer", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "阶段分布" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "需要跟进" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Analytics Active/ }),
    ).toBeVisible();
  } finally {
    for (const id of created) await request.delete(`/api/applications/${id}`);
  }
});
