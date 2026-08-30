import { expect, test } from "@playwright/test";
import { testDatabase } from "../setup/database";
import {
  cleanupJobMarketCampaign,
  seedJobMarketCampaign,
} from "./job-market-helpers";

test("official apply targets and private tracking stay inside aggregated campaigns", async ({
  page,
  request,
}) => {
  const sql = testDatabase();
  const direct = await seedJobMarketCampaign(sql, {
    companyName: "E2E 单链接公司",
    jobs: [
      {
        title: "安全直达岗位",
        location: "上海",
        applyUrl: "https://jobs.example.com/direct",
      },
    ],
  });
  const multiple = await seedJobMarketCampaign(sql, {
    companyName: "E2E 多岗位公司",
    jobs: [
      {
        title: "多选岗位甲",
        location: "杭州",
        applyUrl: "https://jobs.example.com/a",
      },
      {
        title: "多选岗位乙",
        location: "北京",
        applyUrl: "https://jobs.example.com/b",
      },
    ],
  });
  const unavailable = await seedJobMarketCampaign(sql, {
    companyName: "E2E 已失效公司",
    status: "closed",
    jobs: [
      {
        title: "失效岗位",
        applyUrl: "javascript:alert(1)",
        status: "closed",
      },
    ],
  });
  let applicationId: string | undefined;
  try {
    await page.goto("/");
    const directCard = page
      .locator("article")
      .filter({ hasText: "E2E 单链接公司" });
    await expect(
      directCard.getByRole("link", { name: "立即投递" }),
    ).toHaveAttribute("href", "https://jobs.example.com/direct");
    await expect(
      directCard.getByRole("link", { name: "立即投递" }),
    ).toHaveAttribute("rel", "noopener noreferrer");

    const multiCard = page
      .locator("article")
      .filter({ hasText: "E2E 多岗位公司" });
    await multiCard.getByRole("button", { name: "立即投递" }).click();
    const applyDialog = page.getByRole("dialog", { name: "选择要投递的岗位" });
    await expect(applyDialog.getByText("多选岗位甲")).toBeVisible();
    await expect(applyDialog.getByText("多选岗位乙")).toBeVisible();
    await applyDialog.getByRole("button", { name: "关闭弹窗" }).click();

    await multiCard.getByRole("button", { name: "记录投递" }).click();
    const trackingDialog = page.getByRole("dialog", {
      name: "选择要记录的岗位",
    });
    await trackingDialog.getByText("多选岗位甲").click();
    await expect(page).toHaveURL(
      new RegExp(`/applications/new\\?jobMarketPostId=${multiple.posts[0].id}`),
    );
    await expect(page.getByLabel("公司名称 *")).toHaveValue("E2E 多岗位公司");
    await expect(page.getByLabel("岗位名称 *")).toHaveValue("多选岗位甲");
    await page.getByLabel("投递日期 *").fill("2026-08-30");
    await page.getByRole("button", { name: "保存投递" }).click();
    await expect(
      page.getByRole("heading", { name: "E2E 多岗位公司" }),
    ).toBeVisible();
    const [link] = await sql<Array<{ applicationId: string }>>`
      select application_id as "applicationId" from application_job_market_links
      where post_id=${multiple.posts[0].id}`;
    applicationId = link.applicationId;

    await page.goto("/");
    const refreshedCard = page
      .locator("article")
      .filter({ hasText: "E2E 多岗位公司" });
    await refreshedCard.getByRole("button", { name: "记录投递" }).click();
    await expect(page.getByText("已记录，查看现有投递")).toBeVisible();

    const closedCard = page
      .locator("article")
      .filter({ hasText: "E2E 已失效公司" });
    await expect(
      closedCard.getByRole("button", { name: "立即投递" }),
    ).toBeDisabled();
    await expect(closedCard.locator('a[href^="javascript:"]')).toHaveCount(0);
  } finally {
    if (applicationId)
      await request.delete(`/api/applications/${applicationId}`);
    await cleanupJobMarketCampaign(sql, direct);
    await cleanupJobMarketCampaign(sql, multiple);
    await cleanupJobMarketCampaign(sql, unavailable);
    await sql.end();
  }
});
