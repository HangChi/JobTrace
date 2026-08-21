import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("阶段创建、Markdown 复盘、筛选回顾并删除面经", async ({
  page,
  request,
}) => {
  const application = await (
    await request.post("/api/applications", {
      data: {
        companyName: "E2E 面经闭环",
        positionName: "前端工程师",
        appliedDate: "2026-08-01",
        status: "submitted",
      },
    })
  ).json();
  try {
    const staged = await (
      await request.post(`/api/applications/${application.id}/stages`, {
        data: { stage: "interview_1", occurredOn: "2026-08-18" },
      })
    ).json();
    const occurrence = staged.stageOccurrences.find(
      (item: { stage: string }) => item.stage === "interview_1",
    );

    await page.goto(
      `/interviews/new?applicationId=${application.id}&stageOccurrenceId=${occurrence.id}`,
    );
    await expect(page.getByLabel("关联投递")).toBeDisabled();
    await expect(page.getByLabel("面试轮次")).toHaveValue("interview_1");
    await page.getByRole("button", { name: "开始记录" }).click();
    await expect(page).toHaveURL(/\/interviews\/[0-9a-f-]+$/);

    await page
      .getByLabel("编辑 Markdown")
      .fill(
        [
          "# 一面复盘",
          "",
          "## 缓存穿透",
          "- 当时回答：使用布隆过滤器",
          "- 改进回答：结合空值缓存、限流和监控",
          "",
          "## 下一步",
          "- 补充状态机案例",
        ].join("\n"),
      );
    await page.getByRole("tab", { name: "预览" }).click();
    await expect(page.getByRole("heading", { name: "一面复盘" })).toBeVisible();
    await expect(page.getByText(/已保存/)).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: "完成复盘" }).click();
    await expect(
      page.getByRole("button", { name: "复盘已完成" }),
    ).toBeVisible();
    await expect(page.getByText(/已保存/)).toBeVisible({ timeout: 10_000 });

    await page.getByRole("link", { name: "返回面经列表" }).click();
    await page.getByLabel("搜索").fill("缓存穿透");
    await page.getByRole("button", { name: "筛选" }).click();
    await expect(
      page.getByText("E2E 面经闭环 · 前端工程师", { exact: true }),
    ).toBeVisible();
    const downloadPromise = page.waitForEvent("download");
    await page
      .getByRole("link", { name: /导出 E2E 面经闭环.*Markdown/ })
      .click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(
      "E2E 面经闭环-前端工程师-一面面经-时长未记录.md",
    );
    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();
    expect(await readFile(downloadPath!, "utf8")).toContain("# 一面复盘");
    await page.getByRole("button", { name: "删除" }).click();
    await expect(page.getByRole("dialog")).toContainText(
      "E2E 面经闭环 · 前端工程师 · 一面",
    );
    await page.getByRole("button", { name: "确认删除" }).click();
    await expect(
      page.getByRole("heading", { name: "还没有面经" }),
    ).toBeVisible();
  } finally {
    await request.delete(`/api/applications/${application.id}`);
  }
});
