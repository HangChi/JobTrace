import { expect, test } from "@playwright/test";
import {
  seedAdminAuditEvent,
  seedAdminConsoleUser,
} from "../../fixtures/admin-console";
import { testDatabase, testId } from "../../setup/database";

test("audit filters current identities and retains snapshots after deletion", async ({
  request,
}) => {
  const sql = testDatabase();
  await sql`update users set role='admin' where username='playwright_user'`;
  const [actor] = await sql<{ id: string }[]>`
    select id from users where username='playwright_user'`;
  const target = testId("audit-target");
  await seedAdminConsoleUser(sql, {
    id: target,
    username: "audit_snapshot_target",
  });
  const event = await seedAdminAuditEvent(sql, {
    actorId: actor.id,
    targetUserId: target,
    eventType: "disable_user",
    outcome: "denied",
    reason: "Integration audit event preserves identity snapshots.",
  });
  try {
    const response = await request.get(
      "/api/admin/audit-events?actor=playwright_user&target=audit_snapshot&eventType=disable_user&outcome=denied&page=1&limit=10",
    );
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({
      total: 1,
      items: [
        {
          id: event.id,
          actorIdentifier: "playwright_user@users.jobtrace.local",
          targetIdentifier: "audit_snapshot_target@example.test",
          actorDeleted: false,
          targetDeleted: false,
        },
      ],
    });

    await sql`delete from users where id=${target}`;
    const deleted = await request.get(
      "/api/admin/audit-events?target=audit_snapshot_target",
    );
    expect(await deleted.json()).toMatchObject({
      items: [
        {
          id: event.id,
          targetUserId: null,
          targetIdentifier: "audit_snapshot_target@example.test",
          targetDeleted: true,
        },
      ],
    });
    await expect(
      sql`update admin_audit_events set reason='Attempted audit mutation is prohibited.' where id=${event.id}`,
    ).rejects.toThrow();
    await expect(
      sql`delete from admin_audit_events where id=${event.id}`,
    ).rejects.toThrow();
  } finally {
    await sql.end();
  }
});
