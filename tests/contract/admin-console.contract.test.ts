import {
  expect,
  test,
  type APIRequest,
  type APIRequestContext,
} from "@playwright/test";
import { testDatabase } from "../setup/database";

function account(prefix: string) {
  return {
    username: `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}`,
    password: "AdminConsole123!",
  };
}

async function registerContext(
  playwright: { request: APIRequest },
  baseURL: string,
  credentials: ReturnType<typeof account>,
) {
  const ipOctet =
    70 + (Number.parseInt(credentials.username.slice(-2), 16) % 150);
  const context = await playwright.request.newContext({
    baseURL,
    extraHTTPHeaders: {
      origin: baseURL,
      "x-forwarded-for": `198.51.100.${ipOctet}`,
    },
  });
  expect(
    (await context.post("/api/auth/register", { data: credentials })).status(),
  ).toBe(202);
  return context;
}

async function login(
  context: APIRequestContext,
  credentials: ReturnType<typeof account>,
) {
  expect(
    (await context.post("/api/auth/login", { data: credentials })).status(),
  ).toBe(200);
}

test("admin console APIs enforce authorization and validation", async ({
  request,
}) => {
  for (const path of [
    "/api/admin/summary",
    "/api/admin/users",
    "/api/admin/audit-events",
  ]) {
    const response = await request.get(path);
    expect(response.status()).toBe(403);
    expect(await response.json()).toMatchObject({
      code: "forbidden",
      requestId: expect.any(String),
    });
  }
});

test("admin summary, user directory, access change and audit contracts", async ({
  playwright,
  baseURL,
}) => {
  const sql = testDatabase();
  const adminAccount = account("contract_admin");
  const targetAccount = account("contract_target");
  const admin = await registerContext(playwright, baseURL!, adminAccount);
  const target = await registerContext(playwright, baseURL!, targetAccount);
  const [adminRow] = await sql<{ id: string }[]>`
    select id from users where username=${adminAccount.username}`;
  const [targetRow] = await sql<{ id: string; accessVersion: number }[]>`
    select id,access_version "accessVersion" from users where username=${targetAccount.username}`;
  const targetVersion = Number(targetRow.accessVersion);
  await sql`update users set role='admin' where id=${adminRow.id}`;
  await login(admin, adminAccount);

  const summary = await admin.get("/api/admin/summary");
  expect(summary.status()).toBe(200);
  expect(await summary.json()).toMatchObject({
    generatedAt: expect.any(String),
    timeZone: "Asia/Shanghai",
    activityDefinition: expect.any(String),
    counts: { status: "available", value: { users: expect.any(Number) } },
    activity: { status: "available", dailyTrend: expect.any(Array) },
  });

  const users = await admin.get(
    `/api/admin/users?q=${targetAccount.username}&role=user&status=active&page=1&limit=20`,
  );
  expect(users.status()).toBe(200);
  const userPage = await users.json();
  expect(userPage).toMatchObject({
    total: 1,
    page: 1,
    items: [
      {
        id: targetRow.id,
        username: targetAccount.username,
        role: "user",
        disabled: false,
        accessVersion: targetVersion,
      },
    ],
  });
  expect(JSON.stringify(userPage)).not.toMatch(
    /session|token|password|user-agent|resume|notes/i,
  );

  const detail = await admin.get(`/api/admin/users/${targetRow.id}`);
  expect(detail.status()).toBe(200);
  expect(await detail.json()).toMatchObject({
    id: targetRow.id,
    recentAuditEvents: [],
    applications: { items: [], total: 0, page: 1, limit: 10 },
    interviews: { items: [], total: 0, page: 1, limit: 10 },
  });
  expect((await admin.get("/api/admin/users/missing-user")).status()).toBe(404);
  expect((await admin.get("/api/admin/users?role=owner")).status()).toBe(400);
  expect(
    (await admin.get("/api/admin/audit-events?outcome=unknown")).status(),
  ).toBe(400);

  const requestId = crypto.randomUUID();
  const command = {
    requestId,
    expectedVersion: targetVersion,
    action: "disable_user",
    reason: "Contract test disables this user for access review.",
    confirmSelf: false,
  };
  const changed = await admin.patch(`/api/admin/users/${targetRow.id}`, {
    data: command,
  });
  expect(changed.status()).toBe(200);
  expect(await changed.json()).toMatchObject({
    user: { disabled: true, accessVersion: targetVersion + 1 },
    auditEventId: expect.any(String),
    replayed: false,
  });

  const replay = await admin.patch(`/api/admin/users/${targetRow.id}`, {
    data: command,
  });
  expect(replay.status()).toBe(200);
  expect(await replay.json()).toMatchObject({ replayed: true });

  const stale = await admin.patch(`/api/admin/users/${targetRow.id}`, {
    data: { ...command, requestId: crypto.randomUUID() },
  });
  expect(stale.status()).toBe(409);
  expect(await stale.json()).toMatchObject({
    code: "access_version_conflict",
    auditEventId: expect.any(String),
    latestAccessState: {
      disabled: true,
      accessVersion: targetVersion + 1,
    },
  });

  const audit = await admin.get(
    `/api/admin/audit-events?target=${targetRow.id}&eventType=disable_user&page=1`,
  );
  expect(audit.status()).toBe(200);
  const auditPage = await audit.json();
  expect(auditPage.items).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        actorIdentifier: adminAccount.username,
        targetIdentifier: targetAccount.username,
        eventType: "disable_user",
        before: { role: "user", disabled: false, accessVersion: 1 },
      }),
    ]),
  );
  expect(JSON.stringify(auditPage)).not.toMatch(
    /cookie|session|user-agent|ipAddress/i,
  );

  const csrf = await playwright.request.newContext({
    baseURL,
    storageState: await admin.storageState(),
    extraHTTPHeaders: { origin: "https://evil.example" },
  });
  expect(
    (
      await csrf.patch(`/api/admin/users/${targetRow.id}`, {
        data: { ...command, requestId: crypto.randomUUID() },
      })
    ).status(),
  ).toBe(403);

  await Promise.all([
    csrf.dispose(),
    admin.dispose(),
    target.dispose(),
    sql.end(),
  ]);
});
