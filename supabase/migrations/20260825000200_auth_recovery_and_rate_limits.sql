alter table public.users
  add column if not exists recovery_email text;

create unique index if not exists users_recovery_email_idx
  on public.users(lower(recovery_email))
  where recovery_email is not null;

create table if not exists public.auth_rate_limits (
  key_hash text not null,
  action text not null,
  window_started_at timestamptz not null,
  request_count integer not null check(request_count > 0),
  primary key(key_hash, action)
);

create index if not exists auth_rate_limits_expiry_idx
  on public.auth_rate_limits(window_started_at);

create or replace function public.consume_auth_rate_limit(
  request_key_hash text,
  request_action text,
  request_limit integer,
  request_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed boolean;
begin
  if request_key_hash is null
    or request_action is null
    or request_limit < 1
    or request_window_seconds < 1 then
    raise exception using errcode='22023',message='invalid_rate_limit_input';
  end if;

  insert into public.auth_rate_limits(
    key_hash,action,window_started_at,request_count
  )
  values(request_key_hash,request_action,now(),1)
  on conflict(key_hash,action) do update
  set
    window_started_at=case
      when auth_rate_limits.window_started_at
        <= now()-make_interval(secs => request_window_seconds)
      then now()
      else auth_rate_limits.window_started_at
    end,
    request_count=case
      when auth_rate_limits.window_started_at
        <= now()-make_interval(secs => request_window_seconds)
      then 1
      else auth_rate_limits.request_count+1
    end
  returning request_count <= request_limit into allowed;

  delete from public.auth_rate_limits
  where window_started_at < now()-interval '1 day';
  return allowed;
end
$$;
