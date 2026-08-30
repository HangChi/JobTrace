import { expect, test } from "@playwright/test";
import {
  cleanupTestUsers,
  createTestUser,
  testDatabase,
  testId,
} from "../setup/database";
import {
  cleanupJobMarketCampaign,
  seedJobMarketCampaign,
} from "./job-market-helpers";

test("favorites persist per owner, filter correctly and retain closed history", async ({
  page,
}) => {
  const sql = testDatabase();
  const seeded = await seedJobMarketCampaign(sql, {
    companyName: "E2E 收藏公司",
    jobs: [{ title: "收藏岗位", location: "南京" }],
  });
  const otherOwner = testId("favorite-e2e-other");
  await createTestUser(sql, otherOwner);
  try {
    await page.goto("/");
    const card = page.locator("article").filter({ hasText: "E2E 收藏公司" });
    const favoriteResponse = page.waitForResponse(
      (response) =>
        response.url().includes(`/campaigns/${seeded.campaign.id}/favorite`) &&
        response.request().method() === "PUT",
    );
    await card.getByRole("button", { name: "收藏招聘记录" }).click();
    expect((await favoriteResponse).status()).toBe(200);
    await expect(card.getByRole("button", { name: "取消收藏" })).toBeVisible();
    await page.reload();
    await expect(
      page
        .locator("article")
        .filter({ hasText: "E2E 收藏公司" })
        .getByRole("button", { name: "取消收藏" }),
    ).toBeVisible();

    await page.getByLabel("仅看收藏").check();
    await page.getByRole("button", { name: "筛选" }).click();
    await expect(page).toHaveURL(/favorite=true/);
    await expect(page.getByText("E2E 收藏公司")).toBeVisible();
    expect(
      await sql`select owner_id from job_market_campaign_favorites where campaign_id=${seeded.campaign.id} and owner_id=${otherOwner}`,
    ).toHaveLength(0);

    await sql`update job_market_posts set status='closed' where campaign_id=${seeded.campaign.id}`;
    await sql`update job_market_campaigns set status='closed' where id=${seeded.campaign.id}`;
    await page.reload();
    const closedCard = page
      .locator("article")
      .filter({ hasText: "E2E 收藏公司" });
    await expect(closedCard.getByText("已失效", { exact: true })).toBeVisible();
    await expect(
      closedCard.getByRole("button", { name: "立即投递" }),
    ).toBeDisabled();
  } finally {
    await cleanupJobMarketCampaign(sql, seeded);
    await cleanupTestUsers(sql, [otherOwner]);
  }
});
