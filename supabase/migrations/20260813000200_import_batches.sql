create type public.import_batch_status as enum ('previewed','processing','completed','expired');
create type public.import_row_result as enum ('pending','created','skipped','failed');

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  status public.import_batch_status not null default 'previewed',
  columns jsonb not null default '{}'::jsonb,
  total_rows integer not null check (total_rows between 0 and 10000),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now()
);
create table public.import_rows (
  batch_id uuid not null references public.import_batches(id) on delete cascade,
  row_number integer not null check (row_number > 0),
  normalized_data jsonb,
  errors jsonb not null default '[]'::jsonb,
  duplicate_application_ids uuid[] not null default '{}',
  result public.import_row_result not null default 'pending',
  application_id uuid references public.applications(id) on delete set null,
  primary key (batch_id, row_number)
);
create index import_batches_expiry_idx on public.import_batches (expires_at);
alter table public.import_batches enable row level security;
alter table public.import_rows enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.import_batches, public.import_rows from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on public.import_batches, public.import_rows from authenticated;
  end if;
end
$$;
