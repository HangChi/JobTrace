import { expect, test } from "@playwright/test";
import { testDatabase } from "../setup/database";
import {
  cleanupJobMarketCampaign,
  seedJobMarketCampaign,
} from "./job-market-helpers";

test("marketplace never exposes unsafe apply URLs or active source markup", async ({
  page,
  request,
}) => {
  const sql = testDatabase();
  const seeded = await seedJobMarketCampaign(sql, {
    companyName: "<img src=x onerror=alert(1)>",
    jobs: [
      {
        title: "<script>globalThis.marketXss=true</script>安全岗位",
        location: "上海",
        applyUrl: "javascript:alert(1)",
      },
    ],
  });
  try {
    // 入口带专属 q 参数绕开 30 秒列表缓存
    await page.goto("/?q=onerror");
    await expect(page.getByText("<img src=x onerror=alert(1)>")).toBeVisible();
    expect(
      await page.evaluate(
        () => (globalThis as { marketXss?: boolean }).marketXss,
      ),
    ).toBeUndefined();
    await expect(page.locator('a[href^="javascript:"]')).toHaveCount(0);
    const card = page
      .getByRole("row")
      .filter({ hasText: "<img src=x onerror=alert(1)>" });
    // 现状：列表投递入口统一使用来源 base_url，岗位级 javascript: 地址不会进入 DOM
    await expect(card.getByRole("link", { name: "立即投递" })).toHaveAttribute(
      "href",
      "https://jobs.example.com",
    );

    const internal = await request.post("/api/internal/job-market/sync", {
      headers: { authorization: "Bearer invalid-secret" },
      data: { limit: 1000 },
    });
    expect([400, 401, 404]).toContain(internal.status());
    expect(await internal.text()).not.toMatch(
      /JOB_MARKET_SYNC_SECRET|DATABASE_URL/i,
    );
  } finally {
    await cleanupJobMarketCampaign(sql, seeded);
    await sql.end();
  }
});
