import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import { testDatabase } from "../setup/database";
test("public auth validation and protected admin contract", async ({
  request,
}) => {
  const invalid = await request.post("/api/auth/register", {
    data: { username: "bad name", password: "short" },
    headers: { origin: "http://127.0.0.1:3001" },
  });
  expect(invalid.status()).toBe(400);
  expect(await invalid.json()).toMatchObject({
    code: "validation",
    requestId: expect.any(String),
  });
  const csrf = await request.post("/api/auth/login", {
    data: { username: "nobody", password: "password" },
    headers: { origin: "https://evil.example" },
  });
  expect(csrf.status()).toBe(403);
  expect(await csrf.json()).toMatchObject({ code: "csrf_rejected" });
});

test("public registration enforces the 8–16 character password boundary", async ({
  request,
  baseURL,
}) => {
  for (const [index, password] of ["1234567", "12345678901234567"].entries()) {
    const response = await request.post("/api/auth/register", {
      data: { username: `boundary_${password.length}`, password },
      headers: {
        origin: baseURL!,
        "x-forwarded-for": `198.51.100.${40 + index}`,
      },
    });
    expect(response.status()).toBe(400);
    expect(await response.json()).toMatchObject({ code: "validation" });
  }

  for (const [index, password] of ["12345678", "1234567890123456"].entries()) {
    const response = await request.post("/api/auth/register", {
      data: { username: `accepted_${password.length}`, password },
      headers: {
        origin: baseURL!,
        "x-forwarded-for": `198.51.100.${50 + index}`,
      },
    });
    expect(response.status()).toBe(202);
  }
});

test("duplicate usernames return a specific field-level conflict", async ({
  request,
  baseURL,
}) => {
  const username = `duplicate_${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}`;
  const options = {
    data: { username, password: "Duplicate123!" },
    headers: {
      origin: baseURL!,
      "x-forwarded-for": "198.51.100.60",
    },
  };

  expect((await request.post("/api/auth/register", options)).status()).toBe(
    202,
  );
  const duplicate = await request.post("/api/auth/register", options);
  expect(duplicate.status()).toBe(409);
  expect(await duplicate.json()).toMatchObject({
    code: "registration_conflict",
    message: "该用户名已注册。",
    fieldErrors: [
      {
        field: "username",
        code: "registration_conflict",
        message: "该用户名已注册，请更换一个。",
      },
    ],
  });
});

test("raw Better Auth mutations cannot bypass the public authentication API", async ({
  playwright,
  baseURL,
}) => {
  const sql = testDatabase();
  const anonymous = await playwright.request.newContext({
    baseURL,
    extraHTTPHeaders: { origin: baseURL! },
  });
  const rawEmail = `raw_${crypto.randomUUID()}@example.test`;
  const [existing] = await sql<{ id: string }[]>`
    select id from users where username='playwright_user'
  `;
  const [{ sessionCountBefore }] = await sql<
    Array<{ sessionCountBefore: number }>
  >`select count(*)::int "sessionCountBefore" from sessions where user_id=${existing.id}`;
  const [{ tokenCountBefore }] = await sql<
    Array<{ tokenCountBefore: number }>
  >`select count(*)::int "tokenCountBefore" from verification_tokens`;

  const attempts: Array<[string, Record<string, unknown>]> = [
    [
      "/api/auth/sign-up/email",
      {
        email: rawEmail,
        username: `raw_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`,
        name: "Raw auth bypass",
        password: "RawBypass123!",
      },
    ],
    [
      "/api/auth/sign-in/username",
      { username: "playwright_user", password: "Playwright123!" },
    ],
    [
      "/api/auth/sign-in/email",
      {
        email: "playwright_user@users.jobtrace.local",
        password: "Playwright123!",
      },
    ],
    [
      "/api/auth/request-password-reset",
      {
        email: "playwright_user@users.jobtrace.local",
        redirectTo: "/reset-password",
      },
    ],
    [
      "/api/auth/reset-password",
      { token: "forged", newPassword: "Forged123!" },
    ],
    ["/api/auth/update-user", { name: "Bypassed" }],
    ["/api/auth/admin/set-role", { userId: existing.id, role: "admin" }],
  ];

  for (const [path, data] of attempts) {
    expect((await anonymous.post(path, { data })).status(), path).toBe(404);
  }

  expect(
    await sql`select id from users where lower(email)=lower(${rawEmail})`,
  ).toHaveLength(0);
  const [{ sessionCountAfter }] = await sql<
    Array<{ sessionCountAfter: number }>
  >`select count(*)::int "sessionCountAfter" from sessions where user_id=${existing.id}`;
  const [{ tokenCountAfter }] = await sql<
    Array<{ tokenCountAfter: number }>
  >`select count(*)::int "tokenCountAfter" from verification_tokens`;
  expect(sessionCountAfter).toBe(sessionCountBefore);
  expect(tokenCountAfter).toBe(tokenCountBefore);

  const callback = await anonymous.get(
    "/api/auth/reset-password/invalid-token?callbackURL=%2Freset-password",
    { maxRedirects: 0 },
  );
  expect(callback.status()).toBeGreaterThanOrEqual(300);
  expect(callback.status()).toBeLessThan(400);
  expect(callback.headers().location).toBe(
    `${baseURL}/reset-password?error=INVALID_TOKEN`,
  );

  const validToken = crypto.randomUUID().replaceAll("-", "");
  const tokenIdentifier = createHash("sha256")
    .update(`reset-password:${validToken}`)
    .digest("base64url");
  const verificationId = crypto.randomUUID();
  await sql`
    insert into verification_tokens(id,identifier,value,expires_at)
    values(
      ${verificationId},
      ${tokenIdentifier},
      ${existing.id},
      ${new Date(Date.now() + 60_000)}
    )
  `;
  const validCallback = await anonymous.get(
    `/api/auth/reset-password/${validToken}?callbackURL=%2Freset-password`,
    { maxRedirects: 0 },
  );
  expect(validCallback.status()).toBeGreaterThanOrEqual(300);
  expect(validCallback.status()).toBeLessThan(400);
  expect(validCallback.headers().location).toBe(
    `${baseURL}/reset-password?token=${validToken}`,
  );
  await sql`delete from verification_tokens where id=${verificationId}`;

  await Promise.all([anonymous.dispose(), sql.end()]);
});
