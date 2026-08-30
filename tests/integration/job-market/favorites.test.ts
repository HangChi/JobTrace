import { test, expect } from "@playwright/test";
import {
  createTestUser,
  cleanupTestUsers,
  testDatabase,
  testId,
} from "../../setup/database";
test("campaign favorites remain owner-private and survive campaign closure", async () => {
  const sql = testDatabase();
  const ownerA = testId("favorite-a"),
    ownerB = testId("favorite-b");
  await createTestUser(sql, ownerA);
  await createTestUser(sql, ownerB);
  const [company] = await sql<
    Array<{ id: string }>
  >`insert into job_market_companies(canonical_name,normalized_name,identity_key) values('Favorite Co','favorite co',${testId("company")}) returning id`;
  const [campaign] = await sql<
    Array<{ id: string }>
  >`insert into job_market_campaigns(company_id,campaign_key,status) values(${company.id},'favorite-campaign','closed') returning id`;
  try {
    await sql`insert into job_market_campaign_favorites(owner_id,campaign_id) values(${ownerA},${campaign.id}) on conflict do nothing`;
    expect(
      await sql`select campaign_id from job_market_campaign_favorites where owner_id=${ownerA}`,
    ).toHaveLength(1);
    expect(
      await sql`select campaign_id from job_market_campaign_favorites where owner_id=${ownerB}`,
    ).toHaveLength(0);
    expect(
      (
        await sql<
          Array<{ status: string }>
        >`select status::text from job_market_campaigns where id=${campaign.id}`
      )[0].status,
    ).toBe("closed");
  } finally {
    await sql`delete from job_market_campaign_favorites where campaign_id=${campaign.id}`;
    await sql`delete from job_market_campaigns where id=${campaign.id}`;
    await sql`delete from job_market_companies where id=${company.id}`;
    await cleanupTestUsers(sql, [ownerA, ownerB]);
  }
});
