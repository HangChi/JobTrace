import { expect, test } from "@playwright/test";
import { PostgresReminderRepository } from "@/modules/reminders/infrastructure/postgres-reminder-repository";
import {
  cleanupTestUsers,
  createTestUser,
  testDatabase,
  testId,
} from "../../setup/database";

test("reminder transitions reject stale versions and preserve the event when snoozed", async () => {
  const sql = testDatabase();
  const ownerId = testId("reminder-actions");
  await createTestUser(sql, ownerId);
  try {
    const [application] = await sql<{ id: string }[]>`
      select (public.create_application_for_owner(
        ${ownerId},
        ${sql.json({ companyName: "Action Co", positionName: "Engineer", appliedDate: "2026-09-20", status: "submitted" })}::jsonb
      )).id
    `;
    const [row] = await sql<{ id: string }[]>`
      insert into public.scheduled_reminders(
        owner_id, application_id, title, event_at, notify_at
      ) values(
        ${ownerId}, ${application.id}, 'Follow up',
        '2026-10-09T06:00:00Z', '2026-10-09T05:00:00Z'
      ) returning id
    `;
    const repository = new PostgresReminderRepository();
    const completed = await repository.transition(
      ownerId,
      row.id,
      1,
      "complete",
    );
    expect(completed).toMatchObject({ status: "completed", version: 2 });
    expect(
      await repository.transition(ownerId, row.id, 1, "reopen", {
        eventAt: "2026-10-10T06:00:00.000Z",
        notifyAt: "2026-10-10T05:00:00.000Z",
      }),
    ).toBeNull();

    const reopened = await repository.transition(ownerId, row.id, 2, "reopen", {
      eventAt: "2026-10-10T06:00:00.000Z",
      notifyAt: "2026-10-10T05:00:00.000Z",
    });
    expect(reopened).toMatchObject({ status: "pending", version: 3 });
    const snoozed = await repository.transition(ownerId, row.id, 3, "snooze", {
      notifyAt: "2026-10-10T07:00:00.000Z",
    });
    expect(snoozed).toMatchObject({
      status: "pending",
      version: 4,
      eventAt: "2026-10-10T06:00:00.000Z",
      notifyAt: "2026-10-10T07:00:00.000Z",
    });
    expect(
      await repository.transition(ownerId, row.id, 4, "cancel"),
    ).toMatchObject({ status: "cancelled", version: 5 });
  } finally {
    await cleanupTestUsers(sql, [ownerId]);
  }
});
