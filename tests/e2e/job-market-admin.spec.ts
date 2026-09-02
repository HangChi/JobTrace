import { expect, test } from "@playwright/test";
import { testDatabase, testId } from "../setup/database";
import {
  cleanupJobMarketCampaign,
  seedJobMarketCampaign,
} from "./job-market-helpers";

test("admins can inspect safe health, register and control sources while users browse cached jobs", async ({
  browser,
  page,
  playwright,
  baseURL,
}) => {
  test.setTimeout(60_000);
  const sql = testDatabase();
  const seeded = await seedJobMarketCampaign(sql, {
    companyName: "E2E 来源健康公司",
    jobs: [{ title: "缓存可浏览岗位", location: "成都" }],
  });
  const [run] = await sql<Array<{ id: string }>>`
    insert into job_market_sync_runs(source_id,trigger,worker_id,request_id,status,finished_at,error_code,error_summary,rejected_count)
    values(${seeded.source.id},'scheduled','worker-safe','request-safe','failed',now(),'timeout','来源请求超时。',2) returning id`;
  await sql`update job_market_sources set lease_until=now()+interval '10 minutes',leased_by='worker-safe',last_attempt_at=now() where id=${seeded.source.id}`;

  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 10);
  const credentials = {
    username: `market_admin_${suffix}`,
    password: "MarketAdmin123!",
  };
  const adminRequest = await playwright.request.newContext({
    baseURL,
    extraHTTPHeaders: {
      origin: baseURL!,
      "x-forwarded-for": "198.51.100.219",
    },
  });
  expect(
    (
      await adminRequest.post("/api/auth/register", { data: credentials })
    ).status(),
  ).toBe(202);
  const [admin] = await sql<Array<{ id: string }>>`
    select id from users where username=${credentials.username}`;
  await sql`update users set role='admin' where id=${admin.id}`;
  expect(
    (
      await adminRequest.post("/api/auth/login", { data: credentials })
    ).status(),
  ).toBe(200);
  const adminContext = await browser.newContext({
    storageState: await adminRequest.storageState(),
  });
  const adminPage = await adminContext.newPage();
  const registeredExternalKey = testId("e2e-admin-source");
  let registeredSourceId: string | undefined;
  try {
    await adminPage.goto("/admin/job-market");
    await expect(
      adminPage.getByRole("heading", { name: "来源与同步" }),
    ).toBeVisible();
    const healthRow = adminPage
      .getByRole("row")
      .filter({ hasText: "E2E 来源健康公司" });
    await expect(healthRow.getByText("来源请求超时。")).toBeVisible();
    await expect(healthRow).toContainText("发现 0 / 新增 0 / 更新 0 / 失效 0");
    await healthRow.getByRole("button", { name: "重试" }).click();
    await expect(adminPage.getByRole("status").last()).toContainText(
      "正在同步",
    );

    await adminPage.getByLabel("企业 ID").fill(seeded.company.id);
    await adminPage.getByLabel("来源标识").fill(registeredExternalKey);
    await adminPage
      .getByLabel("HTTPS 入口")
      .fill("https://careers.example.com/jobs");
    await adminPage.getByRole("button", { name: "登记来源" }).click();
    await expect(
      adminPage.getByText("来源已登记，审核后可启用。"),
    ).toBeVisible();
    [registeredSourceId] = (
      await sql<Array<{ id: string }>>`
        select id from job_market_sources where external_key=${registeredExternalKey}`
    ).map((item) => item.id);

    await sql`update job_market_sources set lease_until=null,leased_by=null where id=${seeded.source.id}`;
    await adminPage.reload();
    const refreshedRow = adminPage
      .getByRole("row")
      .filter({ hasText: "E2E 来源健康公司" })
      .first();
    await refreshedRow.getByRole("button", { name: "暂停" }).click();
    await expect(adminPage.getByText("来源状态已更新")).toBeVisible();
    await adminPage.reload();
    await adminPage
      .getByRole("row")
      .filter({ hasText: "E2E 来源健康公司" })
      .first()
      .getByRole("button", { name: "撤销" })
      .click();

    await page.goto("/");
    await expect(page.getByText("E2E 来源健康公司")).toBeVisible();
    expect(
      JSON.stringify(
        await (
          await adminRequest.get("/api/admin/job-market/sync-runs")
        ).json(),
      ),
    ).not.toMatch(/password|authorization|cookie|payload/i);
  } finally {
    if (registeredSourceId)
      await sql`delete from job_market_sources where id=${registeredSourceId}`;
    await sql`delete from job_market_sources where company_id=${seeded.company.id} and id<>${seeded.source.id}`;
    await sql`delete from job_market_sync_runs where id=${run.id}`;
    await cleanupJobMarketCampaign(sql, seeded);
    await sql`delete from users where id=${admin.id}`;
    await Promise.all([
      adminPage.close(),
      adminContext.close(),
      adminRequest.dispose(),
      sql.end(),
    ]);
  }
});
