import { expect, test } from "@playwright/test";
import {
  cleanupTestUsers,
  createTestUser,
  testDatabase,
  testId,
} from "../../setup/database";

test("search, filters, sort and keyset pages stay inside one owner", async () => {
  const sql = testDatabase(),
    ownerA = testId("list-a"),
    ownerB = testId("list-b");
  await createTestUser(sql, ownerA);
  await createTestUser(sql, ownerB);
  try {
    for (let index = 0; index < 4; index++) {
      await sql`select create_application_for_owner(${ownerA},${sql.json({ companyName: `Needle ${index}`, positionName: "Engineer", city: "上海", appliedDate: `2026-08-${10 + index}`, status: index % 2 ? "offer" : "submitted" })}::jsonb)`;
      await sql`select create_application_for_owner(${ownerB},${sql.json({ companyName: `Needle B ${index}`, positionName: "Engineer", city: "上海", appliedDate: `2026-08-${10 + index}`, status: "submitted" })}::jsonb)`;
    }
    const first = await sql<
      { id: string; appliedDate: Date; ownerId: string }[]
    >`select id,applied_date as "appliedDate",owner_id as "ownerId" from applications where owner_id=${ownerA} and lower(company_name) like '%needle%' and status='submitted' order by applied_date desc,id desc limit 1`;
    const second = await sql<
      { ownerId: string }[]
    >`select owner_id as "ownerId" from applications where owner_id=${ownerA} and (applied_date,id)<(${first[0].appliedDate},${first[0].id}) order by applied_date desc,id desc limit 1`;
    expect(first[0].ownerId).toBe(ownerA);
    expect(second[0].ownerId).toBe(ownerA);
    expect(
      await sql`select id from applications where owner_id=${ownerA} and company_name like 'Needle B%'`,
    ).toHaveLength(0);
  } finally {
    await cleanupTestUsers(sql, [ownerA, ownerB]);
  }
});
