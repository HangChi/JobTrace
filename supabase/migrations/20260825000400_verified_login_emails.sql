alter table public.users
  add column if not exists recovery_email_verified_at timestamptz;

update public.users
set recovery_email_verified_at=coalesce(updated_at,created_at),
    email_verified=true
where recovery_email is not null
  and recovery_email_verified_at is null;

create table if not exists public.email_verification_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null check(char_length(email) between 3 and 254),
  purpose text not null check(purpose in ('registration','email_binding')),
  user_id text references public.users(id) on delete cascade,
  code_hash text not null check(char_length(code_hash)=64),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  attempt_count integer not null default 0 check(attempt_count between 0 and 5),
  created_at timestamptz not null default now()
);

create index if not exists email_verification_codes_lookup_idx
  on public.email_verification_codes(lower(email),purpose,user_id,created_at desc)
  where consumed_at is null;

create index if not exists email_verification_codes_expiry_idx
  on public.email_verification_codes(expires_at);
