alter table public.users
  add column if not exists access_version bigint not null default 1
  check (access_version > 0);

alter table public.admin_audit_events
  add column if not exists request_id uuid,
  add column if not exists request_fingerprint text,
  add column if not exists actor_identifier_snapshot text,
  add column if not exists target_identifier_snapshot text,
  add column if not exists outcome text,
  add column if not exists reason text,
  add column if not exists failure_code text;

alter table public.admin_audit_events
  drop constraint if exists admin_audit_events_event_type_check;

update public.admin_audit_events e set
  request_id=coalesce(e.request_id,gen_random_uuid()),
  request_fingerprint=coalesce(e.request_fingerprint,'legacy:' || e.id::text),
  actor_identifier_snapshot=coalesce(e.actor_identifier_snapshot,a.email,e.actor_id),
  target_identifier_snapshot=coalesce(e.target_identifier_snapshot,t.email,e.target_user_id),
  event_type=case e.event_type
    when 'role_changed' then case when e.after_data->>'role'='admin' then 'promote_admin' else 'demote_admin' end
    when 'user_disabled' then 'disable_user'
    when 'user_enabled' then 'enable_user'
    else e.event_type
  end,
  outcome=coalesce(e.outcome,'succeeded'),
  reason=coalesce(e.reason,'历史管理员操作（迁移记录）'),
  before_data=coalesce(e.before_data,'{}'::jsonb)
from public.users a, public.users t
where a.id=e.actor_id and t.id=e.target_user_id;

alter table public.admin_audit_events
  alter column request_id set not null,
  alter column request_fingerprint set not null,
  alter column actor_identifier_snapshot set not null,
  alter column target_identifier_snapshot set not null,
  alter column outcome set not null,
  alter column reason set not null,
  alter column before_data set not null,
  alter column after_data drop not null,
  alter column actor_id drop not null,
  alter column target_user_id drop not null;

alter table public.admin_audit_events
  add constraint admin_audit_event_type_check
    check (event_type in ('promote_admin','demote_admin','disable_user','enable_user')),
  add constraint admin_audit_outcome_check
    check (outcome in ('succeeded','denied','conflict','failed')),
  add constraint admin_audit_reason_check
    check (char_length(trim(reason)) between 10 and 500),
  add constraint admin_audit_failure_code_check
    check (failure_code is null or char_length(failure_code) <= 100);

alter table public.admin_audit_events
  drop constraint if exists admin_audit_events_actor_id_fkey,
  drop constraint if exists admin_audit_events_target_user_id_fkey;
alter table public.admin_audit_events
  add constraint admin_audit_events_actor_id_fkey foreign key(actor_id) references public.users(id) on delete set null,
  add constraint admin_audit_events_target_user_id_fkey foreign key(target_user_id) references public.users(id) on delete set null;

create unique index if not exists admin_audit_request_id_idx on public.admin_audit_events(request_id);
create index if not exists users_admin_created_idx on public.users(role,disabled,created_at desc,id desc);
create index if not exists users_created_idx on public.users(created_at desc,id desc);
create index if not exists users_admin_search_idx on public.users using gin ((lower(coalesce(username,'') || ' ' || email)) extensions.gin_trgm_ops);
create index if not exists sessions_user_created_idx on public.sessions(user_id,created_at desc);
create index if not exists admin_audit_created_idx on public.admin_audit_events(created_at desc,id desc);
create index if not exists admin_audit_actor_idx on public.admin_audit_events(actor_id,created_at desc,id desc);
create index if not exists admin_audit_target_idx on public.admin_audit_events(target_user_id,created_at desc,id desc);
create index if not exists admin_audit_filter_idx on public.admin_audit_events(event_type,outcome,created_at desc,id desc);

create or replace function public.change_user_access_as(
  actor text,
  target text,
  command_request_id uuid,
  expected_version bigint,
  command_action text,
  command_reason text,
  confirm_self boolean default false
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  actor_row public.users;
  target_row public.users;
  result_row public.users;
  existing_event public.admin_audit_events;
  event_id uuid;
  request_fingerprint text;
  result_outcome text;
  result_code text;
  next_role text;
  next_disabled boolean;
  before_state jsonb;
  after_state jsonb;
  active_admins integer;
begin
  if command_action not in ('promote_admin','demote_admin','disable_user','enable_user') then
    raise exception using errcode='22023',message='invalid_admin_action';
  end if;
  if char_length(trim(command_reason)) not between 10 and 500 then
    raise exception using errcode='22023',message='invalid_admin_reason';
  end if;

  request_fingerprint := md5(concat_ws('|',target,expected_version,command_action,trim(command_reason),confirm_self));
  select * into existing_event from admin_audit_events where request_id=command_request_id;
  if found then
    if existing_event.request_fingerprint<>request_fingerprint then
      return jsonb_build_object('outcome','conflict','failureCode','idempotency_conflict',
        'auditEventId',existing_event.id,'replayed',false);
    end if;
    select * into result_row from users where id=target;
    return jsonb_build_object('outcome',existing_event.outcome,'failureCode',existing_event.failure_code,
      'auditEventId',existing_event.id,'replayed',true,'userId',result_row.id,
      'role',result_row.role,'disabled',result_row.disabled,'accessVersion',result_row.access_version);
  end if;

  lock table public.users in share row exclusive mode;
  select * into actor_row from users where id=actor for update;
  if not found or actor_row.role<>'admin' or actor_row.disabled then
    raise exception using errcode='42501',message='admin_required';
  end if;
  select * into target_row from users where id=target for update;
  if not found then raise exception using errcode='P0002',message='user_not_found'; end if;

  before_state := jsonb_build_object('role',target_row.role,'disabled',target_row.disabled,'accessVersion',target_row.access_version);
  next_role := target_row.role;
  next_disabled := target_row.disabled;
  result_outcome := 'succeeded';
  result_code := null;

  if target_row.access_version<>expected_version then
    result_outcome := 'conflict'; result_code := 'access_version_conflict';
  elsif command_action='promote_admin' and (target_row.role='admin' or target_row.disabled) then
    result_outcome := 'conflict'; result_code := 'action_state_conflict';
  elsif command_action='demote_admin' and target_row.role<>'admin' then
    result_outcome := 'conflict'; result_code := 'action_state_conflict';
  elsif command_action='disable_user' and target_row.disabled then
    result_outcome := 'conflict'; result_code := 'action_state_conflict';
  elsif command_action='enable_user' and not target_row.disabled then
    result_outcome := 'conflict'; result_code := 'action_state_conflict';
  elsif actor=target and command_action in ('demote_admin','disable_user') and not confirm_self then
    result_outcome := 'denied'; result_code := 'self_confirmation_required';
  else
    if command_action='promote_admin' then next_role := 'admin'; end if;
    if command_action='demote_admin' then next_role := 'user'; end if;
    if command_action='disable_user' then next_disabled := true; end if;
    if command_action='enable_user' then next_disabled := false; end if;

    if target_row.role='admin' and not target_row.disabled
      and (next_role<>'admin' or next_disabled) then
      select count(*) into active_admins from users where role='admin' and disabled=false;
      if active_admins<=1 then
        result_outcome := 'denied'; result_code := 'last_admin';
      end if;
    end if;
  end if;

  if result_outcome='succeeded' then
    update users set role=next_role,disabled=next_disabled,
      access_version=access_version+1,updated_at=now()
    where id=target returning * into result_row;
    if command_action='disable_user' then delete from sessions where user_id=target; end if;
    after_state := jsonb_build_object('role',result_row.role,'disabled',result_row.disabled,'accessVersion',result_row.access_version);
  else
    result_row := target_row;
    after_state := before_state;
  end if;

  insert into admin_audit_events(
    request_id,request_fingerprint,actor_id,actor_identifier_snapshot,
    target_user_id,target_identifier_snapshot,event_type,outcome,reason,
    before_data,after_data,failure_code
  ) values(
    command_request_id,request_fingerprint,actor_row.id,coalesce(actor_row.display_username,actor_row.username,actor_row.email),
    target_row.id,coalesce(target_row.display_username,target_row.username,target_row.email),command_action,result_outcome,trim(command_reason),
    before_state,after_state,result_code
  ) returning id into event_id;

  return jsonb_build_object('outcome',result_outcome,'failureCode',result_code,
    'auditEventId',event_id,'replayed',false,'userId',result_row.id,
    'role',result_row.role,'disabled',result_row.disabled,'accessVersion',result_row.access_version);
end $$;

revoke execute on function public.change_user_access_as(text,text,uuid,bigint,text,text,boolean) from public;

create or replace function public.update_user_access_as(
  actor text,target text,next_role text,next_disabled boolean
) returns public.users
language plpgsql security definer set search_path=public as $$
declare
  current_row public.users;
  command_result jsonb;
begin
  select * into current_row from users where id=target;
  if not found then raise exception using errcode='P0002',message='user_not_found'; end if;

  if current_row.role is distinct from next_role then
    command_result := public.change_user_access_as(
      actor,target,gen_random_uuid(),current_row.access_version,
      case when next_role='admin' then 'promote_admin' else 'demote_admin' end,
      '兼容旧版管理员角色变更操作',actor=target
    );
    if command_result->>'outcome'<>'succeeded' then
      if command_result->>'failureCode'='last_admin' then
        raise exception using errcode='23514',message='last_admin_guard';
      end if;
      raise exception using errcode='40001',message=coalesce(command_result->>'failureCode','admin_change_conflict');
    end if;
    select * into current_row from users where id=target;
  end if;

  if current_row.disabled is distinct from next_disabled then
    command_result := public.change_user_access_as(
      actor,target,gen_random_uuid(),current_row.access_version,
      case when next_disabled then 'disable_user' else 'enable_user' end,
      '兼容旧版管理员状态变更操作',actor=target
    );
    if command_result->>'outcome'<>'succeeded' then
      if command_result->>'failureCode'='last_admin' then
        raise exception using errcode='23514',message='last_admin_guard';
      end if;
      raise exception using errcode='40001',message=coalesce(command_result->>'failureCode','admin_change_conflict');
    end if;
  end if;
  select * into current_row from users where id=target;
  return current_row;
end $$;

revoke execute on function public.update_user_access_as(text,text,text,boolean) from public;
