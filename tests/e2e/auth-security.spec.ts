import { expect, test, type APIRequest } from "@playwright/test";
import { testDatabase } from "../setup/database";

function credentials(prefix: string) {
  return {
    username: `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`,
    password: "Security123!",
  };
}

async function register(
  playwright: { request: APIRequest },
  baseURL: string,
  account: ReturnType<typeof credentials>,
  ip: string,
) {
  const context = await playwright.request.newContext({
    baseURL,
    extraHTTPHeaders: { origin: baseURL, "x-forwarded-for": ip },
  });
  expect(
    (await context.post("/api/auth/register", { data: account })).status(),
  ).toBe(202);
  return context;
}

test("login does not enumerate users and rejects cross-origin requests", async ({
  request,
  baseURL,
}) => {
  const unknown = await request.post("/api/auth/login", {
    data: { username: "unknown_user", password: "wrong-password" },
    headers: { origin: baseURL! },
  });
  const wrong = await request.post("/api/auth/login", {
    data: { username: "another_unknown", password: "wrong-password" },
    headers: { origin: baseURL! },
  });
  expect(unknown.status()).toBe(401);
  expect(wrong.status()).toBe(401);
  expect((await unknown.json()).code).toBe((await wrong.json()).code);
  const csrf = await request.post("/api/auth/login", {
    data: { username: "unknown_user", password: "wrong-password" },
    headers: { origin: "https://evil.example" },
  });
  expect(csrf.status()).toBe(403);
});

test("session cookie is HttpOnly, SameSite=Lax and path scoped", async ({
  playwright,
  baseURL,
}) => {
  const account = credentials("cookie");
  const context = await register(
    playwright,
    baseURL!,
    account,
    "198.51.100.10",
  );
  const response = await context.post("/api/auth/login", { data: account });
  expect(response.status()).toBe(200);
  const setCookie = response
    .headersArray()
    .filter(({ name }) => name.toLowerCase() === "set-cookie")
    .map(({ value }) => value)
    .join("; ");
  expect(setCookie).toMatch(/better-auth\.session_token=/i);
  expect(setCookie).toMatch(/HttpOnly/i);
  expect(setCookie).toMatch(/SameSite=Lax/i);
  expect(setCookie).toMatch(/Path=\//i);
  expect(setCookie).not.toContain(account.password);
  await context.dispose();
});

test("disabling a user revokes existing sessions and keeps login errors generic", async ({
  playwright,
  baseURL,
}) => {
  const sql = testDatabase();
  const adminAccount = credentials("disable_admin");
  const userAccount = credentials("disable_user");
  const admin = await register(
    playwright,
    baseURL!,
    adminAccount,
    "198.51.100.11",
  );
  const user = await register(
    playwright,
    baseURL!,
    userAccount,
    "198.51.100.12",
  );
  const [adminRow] = await sql<
    { id: string }[]
  >`select id from users where username=${adminAccount.username}`;
  const [userRow] = await sql<
    { id: string }[]
  >`select id from users where username=${userAccount.username}`;
  await sql`update users set role='admin' where id=${adminRow.id}`;
  expect(
    (await admin.post("/api/auth/login", { data: adminAccount })).status(),
  ).toBe(200);
  expect(
    (await user.post("/api/auth/login", { data: userAccount })).status(),
  ).toBe(200);
  expect(
    await sql`select id from sessions where user_id=${userRow.id}`,
  ).not.toHaveLength(0);

  const disabled = await admin.patch(`/api/admin/users/${userRow.id}`, {
    data: { disabled: true },
  });
  expect(disabled.status()).toBe(200);
  expect(
    await sql`select id from sessions where user_id=${userRow.id}`,
  ).toHaveLength(0);
  expect(
    (await user.get("/api/applications", { maxRedirects: 0 })).status(),
  ).toBe(401);
  const relogin = await user.post("/api/auth/login", { data: userAccount });
  expect(relogin.status()).toBe(401);
  expect(await relogin.json()).toMatchObject({ code: "invalid_credentials" });
  await Promise.all([admin.dispose(), user.dispose(), sql.end()]);
});

test("repeated login failures are rate limited", async ({
  request,
  baseURL,
}) => {
  const ip = "203.0.113.250";
  for (let attempt = 0; attempt < 10; attempt++) {
    const response = await request.post("/api/auth/login", {
      data: { username: "rate_limit_user", password: "wrong-password" },
      headers: { origin: baseURL!, "x-forwarded-for": ip },
    });
    expect(response.status()).toBe(401);
  }
  const limited = await request.post("/api/auth/login", {
    data: { username: "rate_limit_user", password: "wrong-password" },
    headers: { origin: baseURL!, "x-forwarded-for": ip },
  });
  expect(limited.status()).toBe(429);
  expect(await limited.json()).toMatchObject({ code: "rate_limited" });
});

test("changing password keeps the current device and revokes other sessions", async ({
  playwright,
  baseURL,
}) => {
  const account = credentials("change_password");
  const nextPassword = "SecurePass456!";
  const currentDevice = await register(
    playwright,
    baseURL!,
    account,
    "198.51.100.21",
  );
  const otherDevice = await playwright.request.newContext({
    baseURL,
    extraHTTPHeaders: {
      origin: baseURL!,
      "x-forwarded-for": "198.51.100.22",
    },
  });
  expect(
    (await currentDevice.post("/api/auth/login", { data: account })).status(),
  ).toBe(200);
  expect(
    (await otherDevice.post("/api/auth/login", { data: account })).status(),
  ).toBe(200);

  const changed = await currentDevice.post("/api/profile/password", {
    data: { currentPassword: account.password, newPassword: nextPassword },
  });
  expect(changed.status()).toBe(200);
  expect(await changed.json()).toMatchObject({
    message: "密码已更新，其他设备已退出登录。",
  });
  expect((await currentDevice.get("/api/applications")).status()).toBe(200);
  expect(
    (await otherDevice.get("/api/applications", { maxRedirects: 0 })).status(),
  ).toBe(401);
  expect(
    (await otherDevice.post("/api/auth/login", { data: account })).status(),
  ).toBe(401);
  expect(
    (
      await otherDevice.post("/api/auth/login", {
        data: { ...account, password: nextPassword },
      })
    ).status(),
  ).toBe(200);
  await Promise.all([currentDevice.dispose(), otherDevice.dispose()]);
});
