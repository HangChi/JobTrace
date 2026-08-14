import { expect, test } from "@playwright/test";
import {
  cleanupTestUsers,
  createTestUser,
  testDatabase,
  testId,
} from "../../setup/database";

test("user analytics and follow-ups exclude other owners", async () => {
  const sql = testDatabase(),
    ownerA = testId("analytics-a"),
    ownerB = testId("analytics-b");
  await createTestUser(sql, ownerA);
  await createTestUser(sql, ownerB);
  try {
    await sql`select create_application_for_owner(${ownerA},${sql.json({ companyName: "A", positionName: "Role", appliedDate: "2026-01-01", status: "submitted" })}::jsonb)`;
    await sql`select create_application_for_owner(${ownerB},${sql.json({ companyName: "B", positionName: "Role", appliedDate: "2026-01-01", status: "offer" })}::jsonb)`;
    const [summary] = await sql<
      { total: number; offers: number; followUps: number }[]
    >`select count(*)::int total,count(*) filter(where status='offer')::int offers,count(*) filter(where status='submitted' and current_date-latest_date>=15)::int as "followUps" from applications where owner_id=${ownerA}`;
    expect(summary).toMatchObject({ total: 1, offers: 0, followUps: 1 });
    const [global] = await sql<
      { total: number }[]
    >`select count(*)::int total from applications where owner_id=any(${[ownerA, ownerB]})`;
    expect(global.total).toBe(2);
  } finally {
    await cleanupTestUsers(sql, [ownerA, ownerB]);
  }
});
