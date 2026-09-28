alter table public.users
  add column reminder_home_enabled boolean not null default true,
  add column reminder_home_view text not null default 'scheduled'
    check (reminder_home_view in ('scheduled', 'suggestions')),
  add column reminder_default_lead text not null default '1h'
    check (reminder_default_lead in ('on_time', '30m', '1h', '1d')),
  add column reminder_default_snooze_minutes integer not null default 30
    check (reminder_default_snooze_minutes in (30, 60, 1440)),
  add column reminder_email_default boolean not null default false;
