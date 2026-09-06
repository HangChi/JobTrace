-- Align application creation with the public contract: stages are optional and,
-- when supplied, are created in the same transaction as the application.
create or replace function public.create_application(
  payload jsonb,
  event_type public.application_event_type default 'created'
)
returns public.applications language plpgsql security definer set search_path = public as $$
declare
  result public.applications;
  stage_item jsonb;
  stage_date date;
begin
  if payload ? 'stages' and jsonb_typeof(payload->'stages') <> 'array' then
    raise exception using errcode='22023',message='invalid_stages';
  end if;

  insert into applications(company_name,position_name,city,job_url,applied_date,type,status,notes,latest_date)
  values(
    trim(payload->>'companyName'),trim(payload->>'positionName'),
    nullif(trim(payload->>'city'),''),nullif(trim(payload->>'jobUrl'),''),
    (payload->>'appliedDate')::date,
    coalesce((payload->>'type')::application_type,'campus_recruitment'),
    coalesce((payload->>'status')::application_status,'submitted'),
    nullif(payload->>'notes',''),(payload->>'appliedDate')::date
  ) returning * into result;

  for stage_item in select value from jsonb_array_elements(coalesce(payload->'stages','[]'::jsonb)) loop
    stage_date := (stage_item->>'occurredOn')::date;
    if stage_date < result.applied_date
      or stage_date > (current_timestamp at time zone 'Asia/Shanghai')::date then
      raise exception using errcode='22023',message='invalid_stage_date';
    end if;
    insert into application_stage_occurrences(application_id,stage,occurred_on)
    values(result.id,(stage_item->>'stage')::recruitment_stage,stage_date);
  end loop;

  update applications set latest_date=greatest(
    applied_date,
    coalesce((select max(occurred_on) from application_stage_occurrences where application_id=result.id),applied_date)
  ) where id=result.id returning * into result;
  insert into application_events(application_id,type,occurred_on,after)
  values(result.id,event_type,result.applied_date,to_jsonb(result));
  for stage_item in select value from jsonb_array_elements(coalesce(payload->'stages','[]'::jsonb)) loop
    insert into application_events(application_id,type,occurred_on,after)
    values(result.id,'stage_added',(stage_item->>'occurredOn')::date,stage_item);
  end loop;
  return result;
end $$;

create or replace function public.create_application_for_owner(
  actor_id text,
  payload jsonb,
  event_type public.application_event_type default 'created'
)
returns public.applications language plpgsql security definer set search_path = public as $$
declare
  result public.applications;
  stage_item jsonb;
  stage_date date;
begin
  if actor_id is null or not exists(select 1 from users where id=actor_id and disabled=false) then
    raise exception using errcode='42501',message='valid_actor_required';
  end if;
  if payload ? 'stages' and jsonb_typeof(payload->'stages') <> 'array' then
    raise exception using errcode='22023',message='invalid_stages';
  end if;

  insert into applications(owner_id,company_name,position_name,city,job_url,applied_date,type,status,notes,latest_date)
  values(
    actor_id,trim(payload->>'companyName'),trim(payload->>'positionName'),
    nullif(trim(payload->>'city'),''),nullif(trim(payload->>'jobUrl'),''),
    (payload->>'appliedDate')::date,
    coalesce((payload->>'type')::application_type,'campus_recruitment'),
    coalesce((payload->>'status')::application_status,'submitted'),
    nullif(payload->>'notes',''),(payload->>'appliedDate')::date
  ) returning * into result;

  for stage_item in select value from jsonb_array_elements(coalesce(payload->'stages','[]'::jsonb)) loop
    stage_date := (stage_item->>'occurredOn')::date;
    if stage_date < result.applied_date
      or stage_date > (current_timestamp at time zone 'Asia/Shanghai')::date then
      raise exception using errcode='22023',message='invalid_stage_date';
    end if;
    insert into application_stage_occurrences(application_id,stage,occurred_on)
    values(result.id,(stage_item->>'stage')::recruitment_stage,stage_date);
  end loop;

  update applications set latest_date=greatest(
    applied_date,
    coalesce((select max(occurred_on) from application_stage_occurrences where application_id=result.id),applied_date)
  ) where id=result.id returning * into result;
  insert into application_events(application_id,type,occurred_on,after)
  values(result.id,event_type,result.applied_date,to_jsonb(result));
  for stage_item in select value from jsonb_array_elements(coalesce(payload->'stages','[]'::jsonb)) loop
    insert into application_events(application_id,type,occurred_on,after)
    values(result.id,'stage_added',(stage_item->>'occurredOn')::date,stage_item);
  end loop;
  return result;
end $$;

revoke execute on function public.create_application(jsonb,public.application_event_type) from public;
revoke execute on function public.create_application_for_owner(text,jsonb,public.application_event_type) from public;

-- A self-demotion invalidates the actor's privileged sessions immediately.
-- Demoting another administrator keeps that user's ordinary sessions intact.
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
    if command_action='disable_user'
      or (actor=target and command_action='demote_admin') then
      delete from sessions where user_id=target;
    end if;
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
