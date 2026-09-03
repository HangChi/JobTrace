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
  expect((await request.post("/api/admin/job-market/bootstrap")).status()).toBe(
    403,
  );
  expect((await request.get("/api/admin/job-market/discovery")).status()).toBe(
    403,
  );
  expect((await request.get("/api/admin/job-market/catalog")).status()).toBe(
    403,
  );
  expect(
    (
      await request.post("/api/admin/job-market/discovery", {
        data: { limit: 10 },
      })
    ).status(),
  ).toBe(403);

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
  let candidateId: string | undefined;
  let approvedSourceId: string | undefined;
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
    const catalog = await admin.get(
      "/api/admin/job-market/catalog?page=1&limit=2",
    );
    expect(catalog.status()).toBe(200);
    expect(await catalog.json()).toMatchObject({
      page: 1,
      limit: 2,
      total: expect.any(Number),
      items: [expect.any(Object), expect.any(Object)],
    });
    expect(
      JSON.stringify(
        await (await admin.get("/api/admin/job-market/sources")).json(),
      ),
    ).not.toMatch(/authorization|password|cookie|payload/i);

    const [candidate] = await sql<Array<{ id: string }>>`
      insert into job_market_source_candidates(
        company_id,entry_url,adapter,external_key,base_url,allowed_hosts,confidence,
        evidence_code,review_status,health_status,http_status
      ) values(
        ${company.id},'https://jobs.ashbyhq.com/admin-contract','ashby',${testId("candidate")},
        'https://api.ashbyhq.com/',${["api.ashbyhq.com"]},'high','known_ashby_url','pending','healthy',200
      ) returning id`;
    candidateId = candidate.id;
    const candidates = await admin.get("/api/admin/job-market/discovery");
    expect(candidates.status()).toBe(200);
    expect(await candidates.json()).toMatchObject({
      items: [
        expect.objectContaining({
          id: candidate.id,
          reviewStatus: "pending",
          healthStatus: "healthy",
        }),
      ],
      summary: expect.objectContaining({ pendingCandidates: 1 }),
    });
    const approved = await admin.patch(
      `/api/admin/job-market/discovery/${candidate.id}`,
      { data: { action: "approve" } },
    );
    expect(approved.status()).toBe(200);
    const approval = await approved.json();
    const approvedId = String(approval.sourceId);
    approvedSourceId = approvedId;
    expect(approval).toMatchObject({ reviewStatus: "approved" });
    const approvedSources = await sql<
      Array<{ status: string; allowedHosts: string[] }>
    >`
      select status::text,allowed_hosts as "allowedHosts" from job_market_sources
      where id=${approvedId}`;
    expect(approvedSources[0]).toEqual({
      status: "active",
      allowedHosts: ["api.ashbyhq.com"],
    });
  } finally {
    if (candidateId)
      await sql`delete from job_market_source_candidates where id=${candidateId}`;
    if (approvedSourceId)
      await sql`delete from job_market_sources where id=${approvedSourceId}`;
    if (sourceId) {
      await sql`delete from job_market_sync_runs where source_id=${sourceId}`;
      await sql`delete from job_market_sources where id=${sourceId}`;
    }
    await sql`delete from job_market_companies where id=${company.id}`;
    await sql`delete from users where id=${adminRow.id}`;
    await Promise.all([admin.dispose(), sql.end()]);
  }
});
