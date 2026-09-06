import { expect, test } from "@playwright/test";
import { testDatabase } from "../setup/database";
import {
  cleanupJobMarketCampaign,
  seedJobMarketCampaign,
} from "./job-market-helpers";

test("apply targets and private tracking stay inside aggregated campaigns", async ({
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
    // 入口带专属 q 参数绕开 30 秒列表缓存，保证读到本次 seed 的数据
    await page.goto("/?q=公司");
    // 当前聚合卡片统一将「立即投递」指向来源官方入口（source.base_url）
    const directRow = page
      .getByRole("row")
      .filter({ hasText: "E2E 单链接公司" });
    await expect(
      directRow.getByRole("link", { name: "立即投递" }),
    ).toHaveAttribute("href", "https://jobs.example.com");
    await expect(
      directRow.getByRole("link", { name: "立即投递" }),
    ).toHaveAttribute("rel", "noopener noreferrer");

    const multiRow = page
      .getByRole("row")
      .filter({ hasText: "E2E 多岗位公司" });
    await multiRow.getByRole("button", { name: "记录投递" }).click();
    const trackingDialog = page.getByRole("dialog", { name: "记录投递" });
    await expect(trackingDialog.getByLabel("公司名称 *")).toHaveValue(
      "E2E 多岗位公司",
    );
    await expect(trackingDialog.getByLabel("职位链接")).toHaveValue(
      "https://jobs.example.com",
    );
    await trackingDialog.getByLabel("岗位名称 *").fill("多选岗位甲");
    await trackingDialog.getByLabel("投递日期 *").fill("2026-08-30");
    await trackingDialog.getByRole("button", { name: "保存投递" }).click();
    await expect(
      page.getByRole("heading", { name: "E2E 多岗位公司" }),
    ).toBeVisible();
    const [app] = await sql<Array<{ id: string }>>`
      select id from applications
      where company_name='E2E 多岗位公司'
        and owner_id=(select id from users where username='playwright_user')`;
    applicationId = app.id;

    await page.goto("/?q=E2E%20已失效公司");
    await expect(
      page.getByRole("row").filter({ hasText: "E2E 已失效公司" }),
    ).toHaveCount(0);

    await page.goto("/?q=E2E%20已失效公司&status=closed");
    const closedRow = page
      .getByRole("row")
      .filter({ hasText: "E2E 已失效公司" });
    await expect(closedRow.getByText("失效岗位")).toBeVisible();
    await expect(
      closedRow.getByRole("button", { name: "立即投递" }),
    ).toBeDisabled();
    await expect(closedRow.locator('a[href^="javascript:"]')).toHaveCount(0);
  } finally {
    if (applicationId)
      await request.delete(`/api/applications/${applicationId}`);
    await cleanupJobMarketCampaign(sql, direct);
    await cleanupJobMarketCampaign(sql, multiple);
    await cleanupJobMarketCampaign(sql, unavailable);
    await sql.end();
  }
});
