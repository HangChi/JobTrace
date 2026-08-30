import { expect, test } from "@playwright/test";
import { testDatabase, testId } from "../../setup/database";

test("job-market admin routes enforce RBAC, validation, conflicts and safe run output", async ({
  request,
  playwright,
  baseURL,
}) => {
  expect((await request.get("/api/admin/job-market/sources")).status()).toBe(
    403,
  );

  const username = `market_admin_${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}`;
  const password = "MarketAdmin123!";
  const admin = await playwright.request.newContext({
    baseURL,
    extraHTTPHeaders: {
      origin: baseURL!,
      "x-forwarded-for": `198.51.100.${100 + Math.floor(Math.random() * 100)}`,
    },
  });
  expect(
    (
      await admin.post("/api/auth/register", {
        data: { username, password },
      })
    ).status(),
  ).toBe(202);
  const sql = testDatabase();
  const [adminRow] = await sql<Array<{ id: string }>>`
    select id from users where username=${username}`;
  await sql`update users set role='admin' where id=${adminRow.id}`;
  expect(
    (
      await admin.post("/api/auth/login", {
        data: { username, password },
      })
    ).status(),
  ).toBe(200);

  const [company] = await sql<Array<{ id: string }>>`
    insert into job_market_companies(canonical_name,normalized_name,identity_key)
    values('Admin Contract','admin contract',${testId("company")}) returning id`;
  let sourceId: string | undefined;
  try {
    const invalid = await admin.post("/api/admin/job-market/sources", {
      data: {
        companyId: company.id,
        adapter: "greenhouse",
        externalKey: "invalid",
        baseUrl: "http://jobs.example.com",
        allowedHosts: ["jobs.example.com"],
        accessBasis: "public",
      },
    });
    expect(invalid.status()).toBe(400);

    const payload = {
      companyId: company.id,
      adapter: "greenhouse",
      externalKey: testId("source"),
      baseUrl: "https://jobs.example.com",
      allowedHosts: ["jobs.example.com"],
      accessBasis: "public",
      isOfficial: true,
      syncIntervalMinutes: 360,
    };
    const created = await admin.post("/api/admin/job-market/sources", {
      data: payload,
    });
    expect(created.status()).toBe(201);
    const source = await created.json();
    sourceId = source.id;
    expect(source).toMatchObject({ status: "paused", adapter: "greenhouse" });
    expect(
      (
        await admin.post("/api/admin/job-market/sources", { data: payload })
      ).status(),
    ).toBe(409);

    const activated = await admin.patch(
      `/api/admin/job-market/sources/${source.id}`,
      { data: { status: "active", syncIntervalMinutes: 720 } },
    );
    expect(activated.status()).toBe(200);
    expect(await activated.json()).toMatchObject({ status: "active" });
    const paused = await admin.patch(
      `/api/admin/job-market/sources/${source.id}`,
      { data: { status: "paused" } },
    );
    expect(paused.status()).toBe(200);

    const retry = await admin.post(
      `/api/admin/job-market/sources/${source.id}/sync`,
      { headers: { "x-request-id": "admin-contract-request" } },
    );
    expect(retry.status()).toBe(409);
    expect(await retry.json()).toMatchObject({
      code: "source_unavailable_or_leased",
    });

    const runs = await admin.get(
      `/api/admin/job-market/sync-runs?sourceId=${source.id}`,
    );
    expect(runs.status()).toBe(200);
    expect(await runs.json()).toMatchObject({ items: [], page: 1, limit: 20 });
    expect(
      JSON.stringify(
        await (await admin.get("/api/admin/job-market/sources")).json(),
      ),
    ).not.toMatch(/authorization|password|cookie|payload/i);
  } finally {
    if (sourceId) {
      await sql`delete from job_market_sync_runs where source_id=${sourceId}`;
      await sql`delete from job_market_sources where id=${sourceId}`;
    }
    await sql`delete from job_market_companies where id=${company.id}`;
    await sql`delete from users where id=${adminRow.id}`;
    await Promise.all([admin.dispose(), sql.end()]);
  }
});
