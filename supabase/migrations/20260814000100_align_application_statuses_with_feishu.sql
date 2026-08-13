-- Align JobTrace application statuses with the Feishu Base "投递" field:
-- Offer / 已投递 / 拒绝.
alter type public.application_status rename to application_status_legacy;
create type public.application_status as enum ('submitted', 'offer', 'refused');

alter table public.applications alter column status drop default;
alter table public.applications
  alter column status type public.application_status
  using (
    case status::text
      when 'offer' then 'offer'
      when 'accepted' then 'offer'
      when 'rejected' then 'refused'
      when 'withdrawn' then 'refused'
      else 'submitted'
    end
  )::public.application_status;
alter table public.applications alter column status set default 'submitted';

create or replace function public.create_application(payload jsonb, event_type public.application_event_type default 'created')
returns public.applications language plpgsql security definer set search_path = public as $$
declare result public.applications;
begin
  insert into applications(company_name, position_name, city, job_url, applied_date, status, notes, latest_date)
  values (trim(payload->>'companyName'), trim(payload->>'positionName'), nullif(trim(payload->>'city'),''), nullif(trim(payload->>'jobUrl'),''),
    (payload->>'appliedDate')::date, coalesce((payload->>'status')::application_status,'submitted'), nullif(payload->>'notes',''), (payload->>'appliedDate')::date)
  returning * into result;
  insert into application_events(application_id,type,occurred_on,after) values(result.id,event_type,result.applied_date,to_jsonb(result));
  return result;
end $$;

create or replace function public.update_application(target_id uuid, expected_version integer, change_date date, payload jsonb)
returns public.applications language plpgsql security definer set search_path = public as $$
declare old_row public.applications; result public.applications; event_kind application_event_type := 'details_changed';
begin
  select * into old_row from applications where id=target_id for update;
  if not found then raise exception using errcode='P0002', message='application_not_found'; end if;
  if old_row.version <> expected_version then raise exception using errcode='40001', message='application_version_conflict'; end if;
  if payload ? 'status' and (payload->>'status')::application_status <> old_row.status then event_kind := 'status_changed'; end if;
  update applications set company_name=coalesce(nullif(trim(payload->>'companyName'),''),company_name), position_name=coalesce(nullif(trim(payload->>'positionName'),''),position_name),
    city=case when payload ? 'city' then nullif(trim(payload->>'city'),'') else city end, job_url=case when payload ? 'jobUrl' then nullif(trim(payload->>'jobUrl'),'') else job_url end,
    applied_date=coalesce((payload->>'appliedDate')::date,applied_date), status=coalesce((payload->>'status')::application_status,status),
    notes=case when payload ? 'notes' then nullif(payload->>'notes','') else notes end, latest_date=greatest(latest_date,change_date), version=version+1, updated_at=now()
  where id=target_id returning * into result;
  insert into application_events(application_id,type,occurred_on,before,after) values(target_id,event_kind,change_date,to_jsonb(old_row),to_jsonb(result));
  return result;
end $$;

create or replace function public.create_application_for_owner(
  actor_id text,
  payload jsonb,
  event_type public.application_event_type default 'created'
)
returns public.applications language plpgsql security definer set search_path = public as $$
declare result public.applications;
begin
  if actor_id is null or not exists(select 1 from users where id=actor_id and disabled=false) then
    raise exception using errcode='42501',message='valid_actor_required';
  end if;
  insert into applications(owner_id,company_name,position_name,city,job_url,applied_date,status,notes,latest_date)
  values(actor_id,trim(payload->>'companyName'),trim(payload->>'positionName'),nullif(trim(payload->>'city'),''),nullif(trim(payload->>'jobUrl'),''),
    (payload->>'appliedDate')::date,coalesce((payload->>'status')::application_status,'submitted'),nullif(payload->>'notes',''),(payload->>'appliedDate')::date)
  returning * into result;
  insert into application_events(application_id,type,occurred_on,after) values(result.id,event_type,result.applied_date,to_jsonb(result));
  return result;
end $$;

create or replace function public.analytics_summary(today date)
returns jsonb language sql stable security definer set search_path=public as $$
select jsonb_build_object(
  'total',count(*),
  'submitted',count(*) filter(where status='submitted'),
  'refused',count(*) filter(where status='refused'),
  'offers',count(*) filter(where status='offer'),
  'addedThisWeek',count(*) filter(where applied_date>=date_trunc('week',today)::date),
  'stageDistribution',coalesce((select jsonb_object_agg(stage,total) from(select stage,count(distinct application_id) total from application_stage_occurrences group by stage)s),'{}'::jsonb)
) from applications;
$$;

drop type public.application_status_legacy;
