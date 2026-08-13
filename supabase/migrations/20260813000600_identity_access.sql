create table public.users (
  id text primary key,
  display_name text not null check (char_length(trim(display_name)) between 1 and 100),
  email text not null unique,
  email_verified boolean not null default false,
  image text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  role text not null default 'user' check (role in ('user', 'admin')),
  disabled boolean not null default false,
  ban_reason text,
  ban_expires timestamptz
);

create table public.sessions (
  id text primary key,
  expires_at timestamptz not null,
  token text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  ip_address text,
  user_agent text,
  user_id text not null references public.users(id) on delete cascade,
  impersonated_by text
);
create index sessions_user_id_idx on public.sessions(user_id);

create table public.accounts (
  id text primary key,
  account_id text not null,
  provider_id text not null,
  user_id text not null references public.users(id) on delete cascade,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  password text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null
);
create index accounts_user_id_idx on public.accounts(user_id);

create table public.verification_tokens (
  id text primary key,
  identifier text not null,
  value text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index verification_tokens_identifier_idx on public.verification_tokens(identifier);

create table public.admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id text not null references public.users(id),
  target_user_id text not null references public.users(id),
  event_type text not null check (event_type in ('role_changed','user_disabled','user_enabled')),
  before_data jsonb,
  after_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.update_user_access_as(
  actor text, target text, next_role text, next_disabled boolean
) returns public.users language plpgsql security definer set search_path=public as $$
declare old_row public.users; result public.users; active_admins integer;
begin
  if not exists(select 1 from users where id=actor and role='admin' and disabled=false) then
    raise exception using errcode='42501',message='admin_required';
  end if;
  if next_role not in ('user','admin') then
    raise exception using errcode='22023',message='invalid_role';
  end if;
  select * into old_row from users where id=target for update;
  if not found then raise exception using errcode='P0002',message='user_not_found'; end if;
  if old_row.role='admin' and not old_row.disabled and (next_role<>'admin' or next_disabled) then
    select count(*) into active_admins from users where role='admin' and disabled=false;
    if active_admins<=1 then raise exception using errcode='23514',message='last_admin_guard'; end if;
  end if;
  update users set role=next_role, disabled=next_disabled, updated_at=now()
    where id=target returning * into result;
  if old_row.role is distinct from result.role then
    insert into admin_audit_events(actor_id,target_user_id,event_type,before_data,after_data)
    values(actor,target,'role_changed',jsonb_build_object('role',old_row.role),jsonb_build_object('role',result.role));
  end if;
  if old_row.disabled is distinct from result.disabled then
    insert into admin_audit_events(actor_id,target_user_id,event_type,before_data,after_data)
    values(actor,target,case when result.disabled then 'user_disabled' else 'user_enabled' end,
      jsonb_build_object('disabled',old_row.disabled),jsonb_build_object('disabled',result.disabled));
    if result.disabled then delete from sessions where user_id=target; end if;
  end if;
  return result;
end $$;

create or replace function public.prevent_admin_audit_mutation()
returns trigger language plpgsql as $$ begin raise exception 'admin_audit_events are append-only'; end $$;
create trigger admin_audit_append_only before update or delete on public.admin_audit_events
for each row execute function public.prevent_admin_audit_mutation();
