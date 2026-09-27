-- Preserve the fact that a stage suggestion was converted even if its reminder
-- is later removed by application cleanup. Application services still create
-- the reminder and resolution atomically.
alter table public.progress_reminder_completions
  drop constraint if exists progress_reminder_resolution_reference;

alter table public.scheduled_reminders
  drop constraint if exists scheduled_reminders_check;
