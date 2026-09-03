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
    // 列表默认视图有 30 秒缓存，入口带专属 q 参数保证读到本次 seed 的数据
    await page.goto("/?q=自动招聘");
    await expect(page.getByRole("heading", { name: "招聘广场" })).toBeVisible();
    const rows = page.getByRole("row").filter({ hasText: "E2E 自动招聘公司" });
    await expect(rows).toHaveCount(2);
    const firstRow = rows.filter({ hasText: "4 个岗位" });
    await expect(firstRow).toHaveCount(1);
    await firstRow.getByRole("button", { name: "查看全部 4 个岗位" }).click();
    const positionsDialog = firstRow.getByRole("dialog", { name: "全部岗位" });
    for (const title of [
      "前端工程师",
      "后端工程师",
      "算法工程师",
      "产品经理",
    ]) {
      await expect(positionsDialog).toContainText(title);
    }

    await page.getByLabel("关键词", { exact: true }).fill("算法工程师");
    await page.getByLabel("地点", { exact: true }).fill("上海");
    await page.getByRole("button", { name: "筛选" }).click();
    await expect(page).toHaveURL(/q=.*location=/);
    await expect(rows).toHaveCount(1);

    await page.getByLabel("关键词", { exact: true }).fill("不存在岗位");
    await page.getByRole("button", { name: "筛选" }).click();
    await expect(
      page.getByRole("heading", { name: "没有符合条件的招聘记录" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "清除筛选" }).last(),
    ).toHaveAttribute("href", "/");

    // 列表默认视图有 30 秒缓存，用全新筛选参数触发一次未缓存的读取来验证更新
    await sql`update job_market_posts set title='更新后的算法岗位',normalized_title='更新后的算法岗位' where id=${first.posts[2].id}`;
    await page.goto("/?q=更新后的算法岗位");
    const updatedRow = page
      .getByRole("row")
      .filter({ hasText: "E2E 自动招聘公司" });
    await expect(updatedRow).toHaveCount(1);
    await updatedRow.getByRole("button", { name: "查看全部 4 个岗位" }).click();
    await expect(
      updatedRow.getByRole("dialog", { name: "全部岗位" }),
    ).toContainText("更新后的算法岗位");
    await expect(page.getByText(/手动导入/)).toHaveCount(0);
  } finally {
    await cleanupJobMarketCampaign(sql, first);
    await cleanupJobMarketCampaign(sql, second);
    await sql.end();
  }
});
