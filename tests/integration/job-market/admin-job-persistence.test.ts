import { expect, test } from "@playwright/test";
import {
  AdminJobConflictError,
  createAdminJobManager,
} from "@/modules/job-market/application/admin-jobs";
import { PostgresAdminJobStore } from "@/modules/job-market/infrastructure/postgres-admin-job-store";
import { testDatabase } from "../../setup/database";

test("admin jobs coordinate and retain status across manager instances", async () => {
  const sql = testDatabase();
  const firstManager = createAdminJobManager(new PostgresAdminJobStore());
  const secondManager = createAdminJobManager(new PostgresAdminJobStore());
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let id: string | undefined;
  try {
    id = await firstManager.start("ats_site_scan", () => gate);
    await expect(
      secondManager.start("ats_site_scan", async () => null),
    ).rejects.toBeInstanceOf(AdminJobConflictError);
    expect(await secondManager.get(id)).toMatchObject({
      id,
      kind: "ats_site_scan",
      status: "running",
    });
    release();
    await expect
      .poll(async () => (await secondManager.get(id!))?.status)
      .toBe("succeeded");
  } finally {
    release?.();
    if (id) await sql`delete from job_market_admin_jobs where id=${id}`;
    await sql.end();
  }
});

test("an expired admin job lease is failed and can be retried", async () => {
  const sql = testDatabase();
  const options = { leaseMs: 10, heartbeatMs: 60_000 };
  const firstManager = createAdminJobManager(
    new PostgresAdminJobStore(),
    options,
  );
  const secondManager = createAdminJobManager(
    new PostgresAdminJobStore(),
    options,
  );
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let first: string | undefined;
  let second: string | undefined;
  try {
    first = await firstManager.start("company_research", () => gate);
    await new Promise((resolve) => setTimeout(resolve, 25));
    second = await secondManager.start(
      "company_research",
      async () => "retried",
    );
    expect(await secondManager.get(first)).toMatchObject({
      status: "failed",
      error: "任务执行进程已中断，请重新运行。",
    });
    await expect
      .poll(async () => (await secondManager.get(second!))?.status)
      .toBe("succeeded");
  } finally {
    release?.();
    if (first || second)
      await sql`delete from job_market_admin_jobs where id in(${first ?? null},${second ?? null})`;
    await sql.end();
  }
});
