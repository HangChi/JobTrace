import { expect, test } from "@playwright/test";
import { createTestUser, testDatabase, testId } from "../../setup/database";

test("role changes are audited and the last active admin is protected", async () => {
  const sql = testDatabase(),
    admin = testId("admin"),
    user = testId("user");
  await createTestUser(sql, admin, "admin");
  await createTestUser(sql, user);
  try {
    await sql`select update_user_access_as(${admin},${user},'admin',false)`;
    expect(
      await sql`select id from admin_audit_events where actor_id=${admin} and target_user_id=${user} and event_type='promote_admin'`,
    ).toHaveLength(1);
    await sql`select update_user_access_as(${user},${admin},'user',false)`;
    await expect(
      sql`select update_user_access_as(${user},${user},'user',false)`,
    ).rejects.toMatchObject({ code: "23514" });
  } finally {
    await sql.end();
  }
});
