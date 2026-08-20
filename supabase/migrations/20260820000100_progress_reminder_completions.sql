create table public.progress_reminder_completions (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null references public.users(id) on delete cascade,
  stage_occurrence_id uuid not null references public.application_stage_occurrences(id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique(owner_id, stage_occurrence_id)
);

create index progress_reminder_completions_owner_idx
  on public.progress_reminder_completions(owner_id, completed_at desc);

alter table public.progress_reminder_completions enable row level security;

do $$
begin
  if exists(select 1 from pg_roles where rolname='anon') then
    revoke all on public.progress_reminder_completions from anon;
  end if;
  if exists(select 1 from pg_roles where rolname='authenticated') then
    revoke all on public.progress_reminder_completions from authenticated;
  end if;
end $$;
