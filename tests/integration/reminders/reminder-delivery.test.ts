import { expect, test } from "@playwright/test";
import { PostgresReminderRepository } from "@/modules/reminders/infrastructure/postgres-reminder-repository";
import {
  cleanupTestUsers,
  createTestUser,
  testDatabase,
  testId,
} from "../../setup/database";

test("due email claims are unique, leased, recoverable, and fenced", async () => {
  const sql = testDatabase();
  const ownerId = testId("reminder-delivery");
  await createTestUser(sql, ownerId);
  try {
    const notifyAt = new Date(Date.now() - 60_000);
    const eventAt = new Date(Date.now() + 3_600_000);
    await sql`
      update public.users set
        recovery_email=${`${ownerId}@example.test`},
        recovery_email_verified_at=now()
      where id=${ownerId}
    `;
    const [application] = await sql<{ id: string }[]>`
      select (public.create_application_for_owner(
        ${ownerId},
        ${sql.json({ companyName: "Mail Co", positionName: "Engineer", appliedDate: "2026-09-20", status: "submitted" })}::jsonb
      )).id
    `;
    const [reminder] = await sql<{ id: string; notifyAt: Date }[]>`
      insert into public.scheduled_reminders(
        owner_id, application_id, title, event_at, notify_at, email_enabled
      ) values(
        ${ownerId}, ${application.id}, 'Follow up',
        ${eventAt}, ${notifyAt}, true
      ) returning id, notify_at as "notifyAt"
    `;
    const repository = new PostgresReminderRepository();
    const [firstClaim] = await repository.claimDue(10, 120, 3);
    expect(firstClaim).toMatchObject({
      id: reminder.id,
      recipient: `${ownerId}@example.test`,
    });
    expect(await repository.claimDue(10, 120, 3)).toHaveLength(0);

    await sql`
      update public.reminder_notification_attempts
      set lease_until=now() - interval '1 second'
      where reminder_id=${reminder.id}
    `;
    const [expired] = await sql<
      {
        reminderStatus: string;
        attemptStatus: string;
        attemptCount: number;
        expired: boolean;
      }[]
    >`
      select r.status as "reminderStatus", n.status as "attemptStatus",
        n.attempt_count as "attemptCount", n.lease_until <= now() as expired
      from public.scheduled_reminders r
      join public.reminder_notification_attempts n on n.reminder_id=r.id
      where r.id=${reminder.id}
    `;
    expect(expired).toEqual({
      reminderStatus: "due",
      attemptStatus: "claimed",
      attemptCount: 1,
      expired: true,
    });
    const eligible = await sql<{ id: string }[]>`
      select r.id from public.scheduled_reminders r
      where r.status='due' and r.email_enabled and exists(
        select 1 from public.reminder_notification_attempts retry
        where retry.reminder_id=r.id and retry.scheduled_for=r.notify_at
          and retry.channel='email' and retry.attempt_count < 3
          and retry.status='claimed' and retry.lease_until <= now()
      )
    `;
    expect(eligible).toHaveLength(1);
    const [recoveredClaim] = await repository.claimDue(10, 120, 3);
    expect(recoveredClaim.id).toBe(reminder.id);
    expect(recoveredClaim.claimToken).not.toBe(firstClaim.claimToken);
    expect(
      await repository.finalizeClaim(
        reminder.id,
        reminder.notifyAt.toISOString(),
        firstClaim.claimToken,
        { status: "sent" },
      ),
    ).toBe(false);
    expect(
      await repository.finalizeClaim(
        reminder.id,
        reminder.notifyAt.toISOString(),
        recoveredClaim.claimToken,
        { status: "sent" },
      ),
    ).toBe(true);
    const [attempt] = await sql<{ status: string; attemptCount: number }[]>`
      select status, attempt_count as "attemptCount"
      from public.reminder_notification_attempts
      where reminder_id=${reminder.id}
    `;
    expect(attempt).toEqual({ status: "sent", attemptCount: 2 });
  } finally {
    await cleanupTestUsers(sql, [ownerId]);
  }
});
