import "server-only";

import { createServerDatabase } from "@/shared/database";
import type {
  DeliveryClaim,
  NotificationAttemptStatus,
  Reminder,
  ReminderInput,
  ReminderPreferences,
  ReminderStatus,
  ReminderSummary,
} from "../application/contracts";

type Sql = ReturnType<typeof createServerDatabase>;

function iso(value: unknown) {
  return value instanceof Date ? value.toISOString() : String(value);
}

function mapReminder(row: Record<string, unknown>): Reminder {
  return {
    id: String(row.id),
    applicationId: String(row.applicationId),
    sourceStageOccurrenceId: row.sourceStageOccurrenceId
      ? String(row.sourceStageOccurrenceId)
      : null,
    companyName: String(row.companyName),
    positionName: String(row.positionName),
    title: String(row.title),
    eventAt: iso(row.eventAt),
    notifyAt: iso(row.notifyAt),
    emailEnabled: Boolean(row.emailEnabled),
    status: row.status as ReminderStatus,
    version: Number(row.version),
    emailStatus: (row.emailStatus as NotificationAttemptStatus | null) ?? null,
    completedAt: row.completedAt ? iso(row.completedAt) : null,
    cancelledAt: row.cancelledAt ? iso(row.cancelledAt) : null,
  };
}

const reminderSelect = `
  select r.*, a.company_name, a.position_name,
    attempt.status as email_status
  from public.scheduled_reminders r
  join public.applications a on a.id=r.application_id
  left join lateral (
    select n.status from public.reminder_notification_attempts n
    where n.reminder_id=r.id and n.scheduled_for=r.notify_at
    order by n.updated_at desc limit 1
  ) attempt on true
`;

export class PostgresReminderRepository {
  constructor(private readonly sql: Sql = createServerDatabase()) {}

  async emailAvailability(ownerId: string) {
    const [row] = await this.sql<Record<string, unknown>[]>`
      select recovery_email,
        recovery_email_verified_at is not null as verified
      from public.users where id=${ownerId}
    `;
    const available = Boolean(row?.verified && row?.recoveryEmail);
    return {
      available,
      address: available ? String(row.recoveryEmail) : null,
    };
  }

  async preferences(ownerId: string): Promise<ReminderPreferences> {
    const [row] = await this.sql<ReminderPreferences[]>`
      select reminder_home_enabled as home_enabled,
        reminder_home_view as home_view,
        reminder_default_lead as default_lead,
        reminder_default_snooze_minutes as default_snooze_minutes,
        reminder_email_default as email_default
      from public.users where id=${ownerId}
    `;
    return (
      row ?? {
        homeEnabled: true,
        homeView: "scheduled",
        defaultLead: "1h",
        defaultSnoozeMinutes: 30,
        emailDefault: false,
      }
    );
  }

  async updatePreferences(ownerId: string, value: ReminderPreferences) {
    const [row] = await this.sql<ReminderPreferences[]>`
      update public.users set
        reminder_home_enabled=${value.homeEnabled},
        reminder_home_view=${value.homeView},
        reminder_default_lead=${value.defaultLead},
        reminder_default_snooze_minutes=${value.defaultSnoozeMinutes},
        reminder_email_default=${value.emailDefault},
        updated_at=now()
      where id=${ownerId}
      returning reminder_home_enabled as home_enabled,
        reminder_home_view as home_view,
        reminder_default_lead as default_lead,
        reminder_default_snooze_minutes as default_snooze_minutes,
        reminder_email_default as email_default
    `;
    return row;
  }

  async list(
    ownerId: string,
    status: "active" | "completed" | "cancelled" = "active",
  ): Promise<ReminderSummary> {
    const statuses = status === "active" ? ["pending", "due"] : [status];
    const rows = await this.sql.unsafe<Record<string, unknown>[]>(
      `${reminderSelect}
       where r.owner_id=$1 and r.status=any($2::text[])
       order by case when r.status='due' or r.notify_at<=now() then 0 else 1 end,
         r.notify_at asc, r.id asc
       limit 200`,
      [ownerId, statuses],
    );
    const items = rows.map(mapReminder);
    return {
      overdue:
        status === "active"
          ? items.filter(
              (item) =>
                item.status === "due" || new Date(item.notifyAt) <= new Date(),
            )
          : [],
      upcoming:
        status === "active"
          ? items.filter(
              (item) =>
                item.status === "pending" &&
                new Date(item.notifyAt) > new Date(),
            )
          : [],
      history: status === "active" ? [] : items,
      email: await this.emailAvailability(ownerId),
    };
  }

  async findOwned(ownerId: string, id: string) {
    const rows = await this.sql.unsafe<Record<string, unknown>[]>(
      `${reminderSelect} where r.owner_id=$1 and r.id=$2 limit 1`,
      [ownerId, id],
    );
    return rows[0] ? mapReminder(rows[0]) : null;
  }

  async create(ownerId: string, input: ReminderInput) {
    const row = await this.sql.begin(async (tx) => {
      const [created] = await tx<Record<string, unknown>[]>`
        insert into public.scheduled_reminders(
          owner_id, application_id, source_stage_occurrence_id, title,
          event_at, notify_at, email_enabled
        )
        select ${ownerId}, a.id, ${input.sourceStageOccurrenceId ?? null},
          ${input.title}, ${input.eventAt}::timestamptz,
          ${input.notifyAt}::timestamptz, ${input.emailEnabled}
        from public.applications a
        where a.id=${input.applicationId} and a.owner_id=${ownerId}
          and (
            ${input.sourceStageOccurrenceId ?? null}::uuid is null
            or exists(
              select 1 from public.application_stage_occurrences s
              where s.id=${input.sourceStageOccurrenceId ?? null}
                and s.application_id=a.id
            )
          )
        returning id
      `;
      if (!created || !input.sourceStageOccurrenceId) return created;
      await tx`
        insert into public.progress_reminder_completions(
          owner_id, stage_occurrence_id, resolution, reminder_id
        ) values(
          ${ownerId}, ${input.sourceStageOccurrenceId}, 'scheduled',
          ${String(created.id)}
        )
        on conflict(owner_id, stage_occurrence_id) do update set
          resolution='scheduled', reminder_id=excluded.reminder_id,
          updated_at=now()
      `;
      return created;
    });
    return row ? this.findOwned(ownerId, String(row.id)) : null;
  }

  async update(
    ownerId: string,
    id: string,
    input: ReminderInput & { version: number },
  ) {
    const [row] = await this.sql<Record<string, unknown>[]>`
      update public.scheduled_reminders r set
        title=${input.title}, event_at=${input.eventAt}::timestamptz,
        notify_at=${input.notifyAt}::timestamptz,
        email_enabled=${input.emailEnabled}, status='pending',
        completed_at=null, cancelled_at=null, version=version+1,
        updated_at=now()
      from public.applications a
      where r.id=${id} and r.owner_id=${ownerId}
        and r.application_id=a.id and a.owner_id=${ownerId}
        and r.version=${input.version}
        and r.status in ('pending','due')
      returning r.id
    `;
    return row ? this.findOwned(ownerId, String(row.id)) : null;
  }

  async transition(
    ownerId: string,
    id: string,
    version: number,
    action: "complete" | "cancel" | "snooze" | "reopen",
    values: { notifyAt?: string; eventAt?: string } = {},
  ) {
    const rows = await this.sql<Record<string, unknown>[]>`
      update public.scheduled_reminders set
        status=${action === "complete" ? "completed" : action === "cancel" ? "cancelled" : "pending"},
        completed_at=${action === "complete" ? this.sql`now()` : null},
        cancelled_at=${action === "cancel" ? this.sql`now()` : null},
        notify_at=coalesce(${values.notifyAt ?? null}::timestamptz, notify_at),
        event_at=coalesce(${values.eventAt ?? null}::timestamptz, event_at),
        version=version+1, updated_at=now()
      where id=${id} and owner_id=${ownerId} and version=${version}
        and (
          (${action} in ('complete','cancel','snooze') and status in ('pending','due'))
          or (${action}='reopen' and status in ('completed','cancelled'))
        )
      returning id
    `;
    return rows[0] ? this.findOwned(ownerId, String(rows[0].id)) : null;
  }

  async resolveSuggestion(
    ownerId: string,
    stageOccurrenceId: string,
    resolution: "completed" | "dismissed" | "scheduled",
    reminderId?: string,
  ) {
    const rows = await this.sql<{ id: string }[]>`
      insert into public.progress_reminder_completions(
        owner_id, stage_occurrence_id, resolution, reminder_id
      )
      select ${ownerId}, s.id, ${resolution}, ${reminderId ?? null}
      from public.application_stage_occurrences s
      join public.applications a on a.id=s.application_id
      where s.id=${stageOccurrenceId} and a.owner_id=${ownerId}
      on conflict(owner_id, stage_occurrence_id) do update set
        resolution=excluded.resolution, reminder_id=excluded.reminder_id,
        updated_at=now()
      returning id
    `;
    return Boolean(rows.length);
  }

  async claimDue(
    limit: number,
    leaseSeconds: number,
    maxAttempts: number,
  ): Promise<DeliveryClaim[]> {
    return this.sql.begin(async (tx) => {
      const due = await tx<Record<string, unknown>[]>`
        select r.id
        from public.scheduled_reminders r
        where (
          r.status='pending' and r.notify_at<=now()
        ) or (
          r.status='due' and r.email_enabled and exists(
            select 1 from public.reminder_notification_attempts retry
            where retry.reminder_id=r.id and retry.scheduled_for=r.notify_at
              and retry.channel='email'
              and retry.attempt_count < ${maxAttempts}
              and (
                (retry.status='failed'
                  and retry.updated_at <= now() - interval '1 minute')
                or (retry.status='claimed' and retry.lease_until <= now())
              )
          )
        )
        order by r.notify_at, r.id
        for update skip locked
        limit ${limit}
      `;
      if (!due.length) return [];
      const ids = due.map((row) => String(row.id));
      await tx`
        update public.scheduled_reminders set status='due', updated_at=now()
        where id=any(${ids}::uuid[]) and status='pending'
      `;
      const rows = await tx<Record<string, unknown>[]>`
        select r.*, a.company_name, a.position_name,
          case when u.recovery_email_verified_at is not null
            then u.recovery_email else null end as recipient,
          gen_random_uuid() as claim_token,
          attempt.status as email_status
        from public.scheduled_reminders r
        join public.applications a on a.id=r.application_id
        join public.users u on u.id=r.owner_id
        left join public.reminder_notification_attempts attempt
          on attempt.reminder_id=r.id and attempt.scheduled_for=r.notify_at
          and attempt.channel='email'
        where r.id=any(${ids}::uuid[])
          and (
            attempt.id is null
            or (attempt.status in ('failed','claimed')
              and attempt.attempt_count < ${maxAttempts}
              and coalesce(attempt.lease_until, '-infinity') <= now())
          )
      `;
      const claims: DeliveryClaim[] = [];
      for (const row of rows) {
        const token = String(row.claimToken);
        const recipient = row.recipient ? String(row.recipient) : null;
        await tx`
          insert into public.reminder_notification_attempts(
            reminder_id, owner_id, channel, scheduled_for, status,
            claim_token, lease_until, recipient
          ) values(
            ${String(row.id)}, ${String(row.ownerId)}, 'email',
            ${iso(row.notifyAt)}::timestamptz,
            ${row.emailEnabled && recipient ? "claimed" : "skipped"},
            ${row.emailEnabled && recipient ? token : null},
            ${row.emailEnabled && recipient ? tx`now() + (${leaseSeconds} * interval '1 second')` : null},
            ${recipient}
          )
          on conflict(reminder_id, scheduled_for, channel) do update set
            status=case when reminder_notification_attempts.status='sent'
              then 'sent' else excluded.status end,
            claim_token=case when reminder_notification_attempts.status='sent'
              then reminder_notification_attempts.claim_token else excluded.claim_token end,
            lease_until=case when reminder_notification_attempts.status='sent'
              then reminder_notification_attempts.lease_until else excluded.lease_until end,
            recipient=excluded.recipient,
            attempt_count=case when reminder_notification_attempts.status='sent'
              then reminder_notification_attempts.attempt_count
              else reminder_notification_attempts.attempt_count+1 end,
            updated_at=now()
        `;
        const reminder = mapReminder(row);
        if (reminder.emailEnabled && recipient)
          claims.push({ ...reminder, claimToken: token, recipient });
      }
      return claims;
    });
  }

  async finalizeClaim(
    reminderId: string,
    scheduledFor: string,
    claimToken: string,
    result: { status: "sent" | "failed"; errorCode?: string },
  ) {
    const rows = await this.sql<{ id: string }[]>`
      update public.reminder_notification_attempts set
        status=${result.status}, error_code=${result.errorCode ?? null},
        sent_at=${result.status === "sent" ? this.sql`now()` : null},
        lease_until=null, updated_at=now()
      where reminder_id=${reminderId}
        and scheduled_for=${scheduledFor}::timestamptz
        and channel='email' and claim_token=${claimToken}
        and status='claimed'
      returning id
    `;
    return Boolean(rows.length);
  }

  async queueEmailRetry(ownerId: string, id: string, version: number) {
    return this.sql.begin(async (tx) => {
      const reminders = await tx<{ id: string }[]>`
        update public.scheduled_reminders set version=version+1, updated_at=now()
        where id=${id} and owner_id=${ownerId} and version=${version}
          and status='due' and email_enabled
        returning id
      `;
      if (!reminders.length) return false;
      const attempts = await tx<{ id: string }[]>`
        update public.reminder_notification_attempts n set
          status='failed', lease_until=null,
          updated_at=now() - interval '2 minutes'
        from public.scheduled_reminders r
        where n.reminder_id=r.id and r.id=${id} and r.owner_id=${ownerId}
          and n.scheduled_for=r.notify_at and n.channel='email'
          and n.status='failed'
        returning n.id
      `;
      return Boolean(attempts.length);
    });
  }
}
