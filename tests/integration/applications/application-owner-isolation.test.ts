import { expect, test } from "@playwright/test";
import {
  cleanupTestUsers,
  createTestUser,
  testDatabase,
  testId,
} from "../../setup/database";

test("two users cannot read, update, stage or delete each other's applications", async () => {
  const sql = testDatabase(),
    ownerA = testId("owner-a"),
    ownerB = testId("owner-b");
  await createTestUser(sql, ownerA);
  await createTestUser(sql, ownerB);
  try {
    const [created] = await sql<
      { id: string }[]
    >`select id from create_application_for_owner(${ownerA}, ${sql.json({ companyName: "Private A", positionName: "Engineer", appliedDate: "2026-08-14", status: "submitted" })}::jsonb)`;
    const visibleToB =
      await sql`select id from applications where id=${created.id} and owner_id=${ownerB}`;
    expect(visibleToB).toHaveLength(0);
    await expect(
      sql`select update_application_for_owner(${ownerB},${created.id},1,current_date,${sql.json({ notes: "stolen" })}::jsonb)`,
    ).rejects.toMatchObject({ code: "P0002" });
    await expect(
      sql`select add_stage_occurrence_for_owner(${ownerB},${created.id},'interview_1',current_date)`,
    ).rejects.toMatchObject({ code: "P0002" });
    expect(
      await sql`delete from applications where id=${created.id} and owner_id=${ownerB} returning id`,
    ).toHaveLength(0);
    expect(
      await sql`select id from applications where id=${created.id} and owner_id=${ownerA}`,
    ).toHaveLength(1);
  } finally {
    await cleanupTestUsers(sql, [ownerA, ownerB]);
  }
});
