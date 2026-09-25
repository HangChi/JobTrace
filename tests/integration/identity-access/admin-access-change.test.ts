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

test("concurrent retries with the same request ID replay one audit result", async () => {
  const sql = testDatabase();
  const retrySql = testDatabase();
  const lockSql = testDatabase();
  const observerSql = testDatabase();
  const admin = testId("concurrent-access-admin");
  const target = testId("concurrent-access-target");
  const requestId = crypto.randomUUID();
  const reason = "Integration test concurrently retries one access command.";
  let releaseUsersLock = () => {};
  let lockHolder: Promise<unknown> | undefined;

  await createTestUser(sql, admin, "admin");
  await createTestUser(sql, target);
  try {
    let confirmUsersLock!: () => void;
    const usersLockHeld = new Promise<void>((resolve) => {
      confirmUsersLock = resolve;
    });
    const releaseGate = new Promise<void>((resolve) => {
      releaseUsersLock = resolve;
    });
    lockHolder = lockSql.begin(async (tx) => {
      await tx`lock table users in access exclusive mode`;
      confirmUsersLock();
      await releaseGate;
    });
    await usersLockHeld;

    const changeAccess = (database: ReturnType<typeof testDatabase>) =>
      database<{ result: Record<string, unknown> }[]>`
        select change_user_access_as(
          ${admin},${target},${requestId}::uuid,1,'promote_admin',${reason},false
        ) result`;
    const completions = Promise.allSettled([
      changeAccess(sql),
      changeAccess(retrySql),
    ]);

    let blockedRequests = 0;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const [locks] = await observerSql<Array<{ count: number }>>`
        select count(*)::int as count
        from pg_locks
        where not granted and (
          locktype='advisory'
          or (locktype='relation' and relation='users'::regclass)
        )
      `;
      blockedRequests = locks.count;
      if (blockedRequests >= 2) break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    expect(blockedRequests).toBeGreaterThanOrEqual(2);

    releaseUsersLock();
    await lockHolder;
    lockHolder = undefined;
    const results = await completions;
    expect(results.every((result) => result.status === "fulfilled")).toBe(true);

    const responses = results.flatMap((result) =>
      result.status === "fulfilled" ? [result.value[0].result] : [],
    );
    expect(responses.map((result) => result.replayed).sort()).toEqual([
      false,
      true,
    ]);
    expect(
      new Set(responses.map((result) => result.auditEventId)),
    ).toHaveProperty("size", 1);
    expect(
      await sql`select id from admin_audit_events where request_id=${requestId}`,
    ).toHaveLength(1);
    expect(
      await sql`select id from users where id=${target} and role='admin' and access_version=2`,
    ).toHaveLength(1);
  } finally {
    releaseUsersLock();
    await lockHolder?.catch(() => undefined);
    await sql`delete from users where id in (${target},${admin})`;
    await observerSql.end();
    await lockSql.end();
    await retrySql.end();
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
