import { expect, test } from "@playwright/test";

test("new accounts require a verified email and can log in with it", async ({
  playwright,
  baseURL,
}) => {
  const context = await playwright.request.newContext({
    baseURL,
    extraHTTPHeaders: { origin: baseURL! },
  });
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 10);
  const username = `email_${suffix}`;
  const email = `${username}@example.com`;
  const password = "EmailLogin123!";

  const missingCode = await context.post("/api/auth/register", {
    data: { username, email, password },
  });
  expect(missingCode.status()).toBe(400);

  const sent = await context.post("/api/auth/email-code", {
    data: { email },
  });
  expect(sent.status()).toBe(202);

  const wrongCode = await context.post("/api/auth/register", {
    data: { username, email, verificationCode: "111111", password },
  });
  expect(wrongCode.status()).toBe(400);
  expect(await wrongCode.json()).toMatchObject({ code: "invalid_email_code" });

  const registered = await context.post("/api/auth/register", {
    data: { username, email, verificationCode: "000000", password },
  });
  expect(registered.status()).toBe(202);

  const login = await context.post("/api/auth/login", {
    data: { identifier: email.toUpperCase(), password },
  });
  expect(login.status()).toBe(200);
  expect(await login.json()).toMatchObject({ redirectTarget: "/" });
  await context.dispose();
});

test("an existing user can change and unbind an email without losing username login", async ({
  request,
  playwright,
  baseURL,
}) => {
  const nextEmail = `changed_${crypto.randomUUID().slice(0, 8)}@example.com`;
  expect(
    (
      await request.post("/api/profile/email/code", {
        data: { email: nextEmail },
      })
    ).status(),
  ).toBe(202);
  const changed = await request.patch("/api/profile/email", {
    data: {
      email: nextEmail,
      verificationCode: "000000",
      currentPassword: "Playwright123!",
    },
  });
  expect(changed.status()).toBe(200);
  expect(await changed.json()).toMatchObject({
    email: nextEmail,
    emailVerified: true,
  });

  const unbound = await request.delete("/api/profile/email", {
    data: { currentPassword: "Playwright123!" },
  });
  expect(unbound.status()).toBe(200);
  expect(await unbound.json()).toMatchObject({
    email: null,
    emailVerified: false,
  });

  const anonymous = await playwright.request.newContext({
    baseURL,
    extraHTTPHeaders: { origin: baseURL! },
  });
  expect(
    (
      await anonymous.post("/api/auth/login", {
        data: { identifier: nextEmail, password: "Playwright123!" },
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await anonymous.post("/api/auth/login", {
        data: { identifier: "playwright_user", password: "Playwright123!" },
      })
    ).status(),
  ).toBe(200);
  await anonymous.dispose();
});
