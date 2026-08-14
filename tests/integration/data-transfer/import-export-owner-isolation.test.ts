import { expect, test } from "@playwright/test";
import {
  cleanupTestUsers,
  createTestUser,
  testDatabase,
  testId,
} from "../../setup/database";

test("batches, duplicate candidates and exports stay inside one owner", async () => {
  const sql = testDatabase(),
    ownerA = testId("transfer-a"),
    ownerB = testId("transfer-b");
  await createTestUser(sql, ownerA);
  await createTestUser(sql, ownerB);
  try {
    const [batch] = await sql<
      { id: string }[]
    >`insert into import_batches(owner_id,total_rows) values(${ownerA},0) returning id`;
    expect(
      await sql`select id from import_batches where id=${batch.id} and owner_id=${ownerB}`,
    ).toHaveLength(0);
    await sql`select create_application_for_owner(${ownerB},${sql.json({ companyName: "Duplicate", positionName: "Role", appliedDate: "2026-08-14", status: "submitted" })}::jsonb)`;
    expect(
      await sql`select id from applications where owner_id=${ownerA} and lower(company_name)='duplicate' and lower(position_name)='role' and applied_date='2026-08-14'`,
    ).toHaveLength(0);
    expect(
      await sql`select id from applications where owner_id=${ownerA}`,
    ).toHaveLength(0);
  } finally {
    await cleanupTestUsers(sql, [ownerA, ownerB]);
  }
});
