import { test, expect } from "@playwright/test";
import {
  createTestUser,
  cleanupTestUsers,
  testDatabase,
  testId,
} from "../../setup/database";
test("public job links preserve immutable owner-private application snapshots", async () => {
  const sql = testDatabase();
  const owner = testId("link-owner"),
    other = testId("link-other");
  await createTestUser(sql, owner);
  await createTestUser(sql, other);
  const [company] = await sql<
    Array<{ id: string }>
  >`insert into job_market_companies(canonical_name,normalized_name,identity_key) values('Link Co','link co',${testId("company")}) returning id`;
  const [campaign] = await sql<
    Array<{ id: string }>
  >`insert into job_market_campaigns(company_id,campaign_key) values(${company.id},'link-campaign') returning id`;
  const [post] = await sql<
    Array<{ id: string }>
  >`insert into job_market_posts(company_id,campaign_id,title,normalized_title,content_hash) values(${company.id},${campaign.id},'Original Role','original role',${"a".repeat(64)}) returning id`;
  const [application] = await sql<
    Array<{ id: string }>
  >`select id from create_application_for_owner(${owner},${sql.json({ companyName: "Link Co", positionName: "Original Role", appliedDate: "2026-08-30", status: "submitted" })}::jsonb)`;
  try {
    await sql`insert into application_job_market_links(application_id,owner_id,post_id,job_title_snapshot,company_name_snapshot) values(${application.id},${owner},${post.id},'Original Role','Link Co')`;
    await expect(
      sql`insert into application_job_market_links(application_id,owner_id,post_id,job_title_snapshot,company_name_snapshot) values(gen_random_uuid(),${owner},${post.id},'Duplicate','Link Co')`,
    ).rejects.toBeTruthy();
    expect(
      await sql`select application_id from application_job_market_links where owner_id=${other}`,
    ).toHaveLength(0);
    await sql`update job_market_posts set title='Changed Role',status='closed' where id=${post.id}`;
    expect(
      (
        await sql<
          Array<{ title: string }>
        >`select job_title_snapshot as title from application_job_market_links where application_id=${application.id}`
      )[0].title,
    ).toBe("Original Role");
  } finally {
    await sql`delete from applications where id=${application.id}`;
    await sql`delete from job_market_posts where id=${post.id}`;
    await sql`delete from job_market_campaigns where id=${campaign.id}`;
    await sql`delete from job_market_companies where id=${company.id}`;
    await cleanupTestUsers(sql, [owner, other]);
  }
});
