import { expect, test } from "@playwright/test";
import {
  seedAdminConsoleSession,
  seedAdminConsoleUser,
} from "../../fixtures/admin-console";
import { testDatabase, testId } from "../../setup/database";

test("summary uses distinct active users and a zero-filled Shanghai 30-day trend", async ({
  request,
}) => {
  const sql = testDatabase();
  await sql`update users set role='admin' where username='playwright_user'`;
  const beforeResponse = await request.get("/api/admin/summary");
  expect(beforeResponse.status()).toBe(200);
  const before = await beforeResponse.json();
  const active = testId("summary-active");
  const disabled = testId("summary-disabled");
  await seedAdminConsoleUser(sql, { id: active });
  await seedAdminConsoleUser(sql, { id: disabled, disabled: true });
  await seedAdminConsoleSession(sql, active);
  await seedAdminConsoleSession(sql, active);
  await seedAdminConsoleSession(sql, disabled);
  try {
    const response = await request.get("/api/admin/summary");
    expect(response.status()).toBe(200);
    const summary = await response.json();
    expect(summary.counts.value.users).toBe(before.counts.value.users + 2);
    expect(summary.counts.value.activeUsers).toBe(
      before.counts.value.activeUsers + 1,
    );
    expect(summary.counts.value.disabledUsers).toBe(
      before.counts.value.disabledUsers + 1,
    );
    expect(summary.activity.windows.active7d).toBe(
      before.activity.windows.active7d + 1,
    );
    expect(summary.activity.dailyTrend).toHaveLength(30);
    expect(summary.activity.dailyTrend.at(-1)).toMatchObject({
      date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      registeredUsers: expect.any(Number),
      activeUsers: expect.any(Number),
    });
    expect(summary.timeZone).toBe("Asia/Shanghai");
  } finally {
    await sql`delete from users where id in (${active},${disabled})`;
    await sql.end();
  }
});
