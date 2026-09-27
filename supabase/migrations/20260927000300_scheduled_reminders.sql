create table public.scheduled_reminders (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null references public.users(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  source_stage_occurrence_id uuid references public.application_stage_occurrences(id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  event_at timestamptz not null,
  notify_at timestamptz not null,
  email_enabled boolean not null default false,
  status text not null default 'pending'
    check (status in ('pending', 'due', 'completed', 'cancelled')),
  completed_at timestamptz,
  cancelled_at timestamptz,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (notify_at <= event_at),
  check ((status = 'completed') = (completed_at is not null)),
  check ((status = 'cancelled') = (cancelled_at is not null))
);

create index scheduled_reminders_owner_status_notify_idx
  on public.scheduled_reminders(owner_id, status, notify_at, id);
create index scheduled_reminders_due_idx
  on public.scheduled_reminders(notify_at, id)
  where status = 'pending';
create index scheduled_reminders_application_status_idx
  on public.scheduled_reminders(application_id, status);

create table public.reminder_notification_attempts (
  id uuid primary key default gen_random_uuid(),
  reminder_id uuid not null references public.scheduled_reminders(id) on delete cascade,
  owner_id text not null references public.users(id) on delete cascade,
  channel text not null check (channel in ('email')),
  scheduled_for timestamptz not null,
  status text not null check (status in ('claimed', 'sent', 'failed', 'skipped')),
  claim_token uuid,
  lease_until timestamptz,
  attempt_count integer not null default 1 check (attempt_count between 1 and 5),
  recipient text,
  error_code text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(reminder_id, scheduled_for, channel)
);

create index reminder_attempts_claim_idx
  on public.reminder_notification_attempts(status, lease_until, id);
create index reminder_attempts_owner_idx
  on public.reminder_notification_attempts(owner_id, created_at desc);

alter table public.progress_reminder_completions
  add column resolution text not null default 'dismissed'
    check (resolution in ('completed', 'dismissed', 'scheduled')),
  add column reminder_id uuid references public.scheduled_reminders(id) on delete set null,
  add column updated_at timestamptz not null default now();

alter table public.progress_reminder_completions
  add constraint progress_reminder_resolution_reference
  check (resolution <> 'scheduled' or reminder_id is not null);

alter table public.scheduled_reminders enable row level security;
alter table public.reminder_notification_attempts enable row level security;

do $$
begin
  if exists(select 1 from pg_roles where rolname='anon') then
    revoke all on public.scheduled_reminders, public.reminder_notification_attempts from anon;
  end if;
  if exists(select 1 from pg_roles where rolname='authenticated') then
    revoke all on public.scheduled_reminders, public.reminder_notification_attempts from authenticated;
  end if;
end $$;
