import { expect, test } from "@playwright/test";
import {
  createTestSession,
  createTestUser,
  testDatabase,
  testId,
} from "../../setup/database";

test("access changes are atomic, versioned, idempotent and revoke sessions", async () => {
  const sql = testDatabase();
  const admin = testId("access-admin");
  const target = testId("access-target");
  await createTestUser(sql, admin, "admin");
  await createTestUser(sql, target);
  await createTestSession(sql, target);
  const requestId = crypto.randomUUID();
  const reason = "Integration test disables this active target account.";
  try {
    const [changed] = await sql<{ result: Record<string, unknown> }[]>`
      select change_user_access_as(
        ${admin},${target},${requestId}::uuid,1,'disable_user',${reason},false
      ) result`;
    expect(changed.result).toMatchObject({
      outcome: "succeeded",
      replayed: false,
      disabled: true,
      accessVersion: 2,
    });
    expect(
      await sql`select id from sessions where user_id=${target}`,
    ).toHaveLength(0);

    const [replayed] = await sql<{ result: Record<string, unknown> }[]>`
      select change_user_access_as(
        ${admin},${target},${requestId}::uuid,1,'disable_user',${reason},false
      ) result`;
    expect(replayed.result).toMatchObject({
      outcome: "succeeded",
      replayed: true,
    });
    expect(
      await sql`select id from admin_audit_events where request_id=${requestId}`,
    ).toHaveLength(1);

    const [stale] = await sql<{ result: Record<string, unknown> }[]>`
      select change_user_access_as(
        ${admin},${target},${crypto.randomUUID()}::uuid,1,'enable_user',
        'Integration test submits an intentionally stale version.',false
      ) result`;
    expect(stale.result).toMatchObject({
      outcome: "conflict",
      failureCode: "access_version_conflict",
      accessVersion: 2,
    });

    const [enabled] = await sql<{ result: Record<string, unknown> }[]>`
      select change_user_access_as(
        ${admin},${target},${crypto.randomUUID()}::uuid,2,'enable_user',
        'Integration test enables the account after review.',false
      ) result`;
    expect(enabled.result).toMatchObject({ disabled: false, accessVersion: 3 });
    expect(
      await sql`select id from sessions where user_id=${target}`,
    ).toHaveLength(0);
  } finally {
    await sql`delete from users where id in (${target},${admin})`;
    await sql.end();
  }
});

test("last active admin and self changes require safety confirmation", async () => {
  const sql = testDatabase();
  const admin = testId("last-admin");
  await sql
    .begin(async (tx) => {
      await tx`insert into users(id,display_name,email,email_verified,role,username,display_username)
      values(${admin},${admin},${`${admin}@example.test`},true,'admin',${admin.slice(0, 30)},${admin.slice(0, 30)})`;
      await tx`update users set disabled=true where role='admin' and id<>${admin}`;
      const [unconfirmed] = await tx<{ result: Record<string, unknown> }[]>`
        select change_user_access_as(
          ${admin},${admin},${crypto.randomUUID()}::uuid,1,'demote_admin',
          'Integration test attempts an unconfirmed self demotion.',false
        ) result`;
      expect(unconfirmed.result).toMatchObject({
        outcome: "denied",
        failureCode: "self_confirmation_required",
      });
      const [lastAdmin] = await tx<{ result: Record<string, unknown> }[]>`
        select change_user_access_as(
          ${admin},${admin},${crypto.randomUUID()}::uuid,1,'demote_admin',
          'Integration test confirms a protected last-admin demotion.',true
        ) result`;
      expect(lastAdmin.result).toMatchObject({
        outcome: "denied",
        failureCode: "last_admin",
      });
      throw new Error("ROLLBACK_LAST_ADMIN_TEST");
    })
    .catch((error) => {
      expect(error).toMatchObject({ message: "ROLLBACK_LAST_ADMIN_TEST" });
    });
  try {
    expect(await sql`select id from users where id=${admin}`).toHaveLength(0);
  } finally {
    await sql.end();
  }
});

test("self demotion revokes own sessions while another-admin demotion preserves sessions", async () => {
  const sql = testDatabase();
  const selfAdmin = testId("self-demote-admin");
  const otherAdmin = testId("other-demote-admin");
  const actor = testId("demotion-actor");
  await createTestUser(sql, selfAdmin, "admin");
  await createTestUser(sql, otherAdmin, "admin");
  await createTestUser(sql, actor, "admin");
  await createTestSession(sql, selfAdmin);
  await createTestSession(sql, otherAdmin);
  try {
    const [selfDemotion] = await sql<{ result: Record<string, unknown> }[]>`
      select change_user_access_as(
        ${selfAdmin},${selfAdmin},${crypto.randomUUID()}::uuid,1,'demote_admin',
        'Integration test confirms this administrator self demotion.',true
      ) result`;
    expect(selfDemotion.result).toMatchObject({
      outcome: "succeeded",
      role: "user",
    });
    expect(
      await sql`select id from sessions where user_id=${selfAdmin}`,
    ).toHaveLength(0);

    const [demotedByOther] = await sql<{ result: Record<string, unknown> }[]>`
      select change_user_access_as(
        ${actor},${otherAdmin},${crypto.randomUUID()}::uuid,1,'demote_admin',
        'Integration test demotes another administrator safely.',false
      ) result`;
    expect(demotedByOther.result).toMatchObject({
      outcome: "succeeded",
      role: "user",
    });
    expect(
      await sql`select id from sessions where user_id=${otherAdmin}`,
    ).toHaveLength(1);
  } finally {
    await sql`delete from users where id in (${selfAdmin},${otherAdmin},${actor})`;
    await sql.end();
  }
});
