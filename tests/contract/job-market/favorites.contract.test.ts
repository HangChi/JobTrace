import { test, expect } from "@playwright/test";
import {
  cleanupTestUsers,
  createTestUser,
  testDatabase,
  testId,
} from "../../setup/database";

test("favorite PUT/DELETE is idempotent and favorite filtering is owner-scoped", async ({
  request,
}) => {
  const sql = testDatabase();
  const [owner] = await sql<Array<{ id: string }>>`
    select id from users where username='playwright_user'`;
  const otherOwner = testId("favorite-contract-other");
  await createTestUser(sql, otherOwner);
  const [company] = await sql<Array<{ id: string }>>`
    insert into job_market_companies(canonical_name,normalized_name,identity_key)
    values('Favorite Contract','favorite contract',${testId("company")}) returning id`;
  const [campaign] = await sql<Array<{ id: string }>>`
    insert into job_market_campaigns(company_id,campaign_key,name)
    values(${company.id},${testId("campaign")},'Favorite Contract') returning id`;
  try {
    await sql`insert into job_market_campaign_favorites(owner_id,campaign_id)
      values(${otherOwner},${campaign.id})`;
    expect(
      (await request.get("/api/job-market/campaigns?favorite=true")).status(),
    ).toBe(200);
    expect(
      (
        await (
          await request.get("/api/job-market/campaigns?favorite=true")
        ).json()
      ).items,
    ).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: campaign.id })]),
    );

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const favorite = await request.put(
        `/api/job-market/campaigns/${campaign.id}/favorite`,
      );
      expect(favorite.status()).toBe(200);
      expect(await favorite.json()).toEqual({
        campaignId: campaign.id,
        isFavorite: true,
      });
    }
    const filtered = await (
      await request.get("/api/job-market/campaigns?favorite=true")
    ).json();
    expect(filtered.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: campaign.id })]),
    );
    expect(
      await sql`select owner_id from job_market_campaign_favorites where campaign_id=${campaign.id}`,
    ).toHaveLength(2);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const removed = await request.delete(
        `/api/job-market/campaigns/${campaign.id}/favorite`,
      );
      expect(removed.status()).toBe(200);
      expect(await removed.json()).toMatchObject({ isFavorite: false });
    }
    expect(
      await sql`select owner_id from job_market_campaign_favorites where campaign_id=${campaign.id} and owner_id=${owner.id}`,
    ).toHaveLength(0);
  } finally {
    await sql`delete from job_market_campaign_favorites where campaign_id=${campaign.id}`;
    await sql`delete from job_market_campaigns where id=${campaign.id}`;
    await sql`delete from job_market_companies where id=${company.id}`;
    await cleanupTestUsers(sql, [otherOwner]);
  }
});
