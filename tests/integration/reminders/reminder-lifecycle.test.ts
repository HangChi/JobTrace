import { expect, test } from "@playwright/test";
import {
  cleanupTestUsers,
  createTestUser,
  testDatabase,
  testId,
} from "../../setup/database";

test("scheduled reminders keep owner isolation, versions, and delete cascade", async () => {
  const sql = testDatabase();
  const ownerA = testId("reminder-a");
  const ownerB = testId("reminder-b");
  await createTestUser(sql, ownerA);
  await createTestUser(sql, ownerB);
  try {
    const [application] = await sql<{ id: string }[]>`
      select (public.create_application_for_owner(
        ${ownerA},
        ${sql.json({ companyName: "A", positionName: "Engineer", appliedDate: "2026-09-20", status: "submitted" })}::jsonb
      )).id
    `;
    const [reminder] = await sql<{ id: string; version: number }[]>`
      insert into public.scheduled_reminders(
        owner_id, application_id, title, event_at, notify_at
      ) values(
        ${ownerA}, ${application.id}, 'Follow up',
        '2026-10-08T06:00:00Z', '2026-10-08T05:00:00Z'
      ) returning id, version
    `;
    expect(reminder.version).toBe(1);
    const otherOwnerRows = await sql`
      select id from public.scheduled_reminders
      where id=${reminder.id} and owner_id=${ownerB}
    `;
    expect(otherOwnerRows).toHaveLength(0);
    const updated = await sql<{ version: number }[]>`
      update public.scheduled_reminders set version=version+1
      where id=${reminder.id} and owner_id=${ownerA} and version=1
      returning version
    `;
    expect(updated[0].version).toBe(2);
    const stale = await sql`
      update public.scheduled_reminders set title='stale'
      where id=${reminder.id} and owner_id=${ownerA} and version=1
      returning id
    `;
    expect(stale).toHaveLength(0);
    await sql`delete from public.applications where id=${application.id}`;
    expect(
      await sql`select id from public.scheduled_reminders where id=${reminder.id}`,
    ).toHaveLength(0);
  } finally {
    await cleanupTestUsers(sql, [ownerA, ownerB]);
  }
});
