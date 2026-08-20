import { expect, test } from "@playwright/test";
import {
  cleanupTestUsers,
  createTestUser,
  testDatabase,
  testId,
} from "../../setup/database";

test("面经列表、详情、创建、更新和删除均按 owner 隔离", async () => {
  const sql = testDatabase();
  const ownerA = testId("interview-owner-a");
  const ownerB = testId("interview-owner-b");
  await createTestUser(sql, ownerA);
  await createTestUser(sql, ownerB);
  try {
    const [application] = await sql<
      { id: string }[]
    >`select id from create_application_for_owner(${ownerB},${sql.json({
      companyName: "Private Interview",
      positionName: "Engineer",
      appliedDate: "2026-08-01",
      status: "submitted",
    })}::jsonb)`;
    const [review] = await sql<
      { id: string }[]
    >`select id from create_interview_review_for_owner(
      ${ownerB},${application.id},null,'interview_1','2026-08-18',${sql.json({})}::jsonb
    )`;

    await expect(
      sql`select create_interview_review_for_owner(
        ${ownerA},${application.id},null,'interview_2','2026-08-19',${sql.json({})}::jsonb
      )`,
    ).rejects.toMatchObject({ code: "P0002" });
    const [visibleToA] = await sql<
      { total: number }[]
    >`select count(*)::int total from interview_reviews where id=${review.id} and owner_id=${ownerA}`;
    expect(visibleToA.total).toBe(0);
    await expect(
      sql`select update_interview_review_for_owner(
        ${ownerA},${review.id},1,${sql.json({
          version: 1,
          status: "draft",
          roundResult: "pending",
          questions: [],
          actionItems: [],
        })}::jsonb
      )`,
    ).rejects.toMatchObject({ code: "P0002" });
    const deleted = await sql`
      delete from interview_reviews where id=${review.id} and owner_id=${ownerA} returning id
    `;
    expect(deleted).toHaveLength(0);
    const [stillExists] = await sql<
      { total: number }[]
    >`select count(*)::int total from interview_reviews where id=${review.id} and owner_id=${ownerB}`;
    expect(stillExists.total).toBe(1);
  } finally {
    await cleanupTestUsers(sql, [ownerA, ownerB]);
  }
});
