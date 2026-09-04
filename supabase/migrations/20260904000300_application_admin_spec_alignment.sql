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
