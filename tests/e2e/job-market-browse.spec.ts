import { expect, test } from "@playwright/test";
import { testDatabase } from "../setup/database";
import {
  cleanupJobMarketCampaign,
  seedJobMarketCampaign,
} from "./job-market-helpers";

test("fixture-backed marketplace aggregates jobs and supports combined URL filters and updates", async ({
  page,
}) => {
  const sql = testDatabase();
  const first = await seedJobMarketCampaign(sql, {
    companyName: "E2E 自动招聘公司",
    campaignName: "2027 秋招第一批",
    jobs: [
      { title: "前端工程师", location: "上海" },
      { title: "后端工程师", location: "杭州" },
      { title: "算法工程师", location: "上海" },
      { title: "产品经理", location: "深圳" },
    ],
  });
  const second = await seedJobMarketCampaign(sql, {
    companyName: "E2E 自动招聘公司",
    campaignName: "2027 秋招第二批",
    jobs: [{ title: "测试工程师", location: "北京" }],
  });
  try {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "招聘广场" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "E2E 自动招聘公司" }),
    ).toHaveCount(2);
    await expect(
      page.locator("article").filter({ hasText: "2027 秋招第一批" }),
    ).toHaveCount(1);
    const firstCard = page
      .locator("article")
      .filter({ hasText: "2027 秋招第一批" });
    await firstCard.getByText("查看全部 4 个岗位").click();
    for (const title of [
      "前端工程师",
      "后端工程师",
      "算法工程师",
      "产品经理",
    ]) {
      await expect(firstCard).toContainText(title);
    }

    await page.getByLabel("关键词").fill("算法工程师");
    await page.getByLabel("地点").fill("上海");
    await page.getByRole("button", { name: "筛选" }).click();
    await expect(page).toHaveURL(/q=.*location=/);
    await expect(page.locator("article")).toHaveCount(1);
    await expect(page.getByText("2027 秋招第一批")).toBeVisible();

    await page.getByLabel("关键词").fill("不存在岗位");
    await page.getByRole("button", { name: "筛选" }).click();
    await expect(
      page.getByRole("heading", { name: "没有符合条件的招聘记录" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "清除筛选" }).last(),
    ).toHaveAttribute("href", "/");
    await page.goto("/");

    await sql`update job_market_posts set title='更新后的算法岗位',normalized_title='更新后的算法岗位' where id=${first.posts[2].id}`;
    await page.reload();
    const updatedCard = page
      .locator("article")
      .filter({ hasText: "2027 秋招第一批" });
    await updatedCard.getByText("查看全部 4 个岗位").click();
    await expect(updatedCard).toContainText("更新后的算法岗位");
    await expect(page.getByText(/手动导入/)).toHaveCount(0);
  } finally {
    await cleanupJobMarketCampaign(sql, first);
    await cleanupJobMarketCampaign(sql, second);
    await sql.end();
  }
});
