import { expect, test } from "@playwright/test";
import { testDatabase } from "../setup/database";

test("guest, user and disabled admin cannot read or mutate admin resources", async ({
  browser,
  playwright,
  baseURL,
}) => {
  const sql = testDatabase();
  const guest = await playwright.request.newContext({
    baseURL,
    storageState: { cookies: [], origins: [] },
  });
  const account = {
    username: `security_user_${crypto.randomUUID().replaceAll("-", "").slice(0, 8)}`,
    password: "Security123!",
  };
  const user = await playwright.request.newContext({
    baseURL,
    extraHTTPHeaders: { origin: baseURL!, "x-forwarded-for": "198.51.100.191" },
  });
  expect(
    (await user.post("/api/auth/register", { data: account })).status(),
  ).toBe(202);
  expect((await user.post("/api/auth/login", { data: account })).status()).toBe(
    200,
  );
  const [row] = await sql<{ id: string }[]>`
    select id from users where username=${account.username}`;
  await sql`update users set role='user',disabled=false where id=${row.id}`;

  for (const client of [guest, user]) {
    for (const route of [
      "/api/admin/summary",
      "/api/admin/users",
      "/api/admin/audit-events",
    ]) {
      const response = await client.get(route);
      expect(
        [401, 403],
        `${client === guest ? "guest" : "user"} ${route}`,
      ).toContain(response.status());
      expect(await response.text()).not.toMatch(
        /password|better-auth|session_token|user-agent|interviewer_notes|notes/i,
      );
    }
  }

  await sql`update users set role='admin',disabled=true where id=${row.id}`;
  expect((await user.get("/api/admin/summary")).status()).toBe(403);
  const disabledBrowser = await browser.newContext({
    storageState: await user.storageState(),
  });
  const page = await disabledBrowser.newPage();
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login/);

  const csrf = await playwright.request.newContext({
    baseURL,
    storageState: await user.storageState(),
    extraHTTPHeaders: { origin: "https://evil.example" },
  });
  expect(
    (
      await csrf.patch(`/api/admin/users/${row.id}`, {
        data: {
          requestId: crypto.randomUUID(),
          expectedVersion: 1,
          action: "enable_user",
          reason: "Cross-site request must never change this account.",
        },
      })
    ).status(),
  ).toBe(403);
  await Promise.all([
    guest.dispose(),
    user.dispose(),
    csrf.dispose(),
    disabledBrowser.close(),
    sql.end(),
  ]);
});
