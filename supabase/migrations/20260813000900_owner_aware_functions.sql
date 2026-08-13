create or replace function public.create_application_for_owner(actor_id text, payload jsonb, event_type public.application_event_type default 'created')
returns public.applications language plpgsql security definer set search_path = public as $$
declare result public.applications;
begin
  if actor_id is null or not exists(select 1 from users where id=actor_id and disabled=false) then
    raise exception using errcode='42501',message='valid_actor_required';
  end if;
  insert into applications(owner_id,company_name,position_name,city,job_url,applied_date,status,notes,latest_date)
  values(actor_id,trim(payload->>'companyName'),trim(payload->>'positionName'),nullif(trim(payload->>'city'),''),nullif(trim(payload->>'jobUrl'),''),
    (payload->>'appliedDate')::date,coalesce((payload->>'status')::application_status,'active'),nullif(payload->>'notes',''),(payload->>'appliedDate')::date)
  returning * into result;
  insert into application_events(application_id,type,occurred_on,after) values(result.id,event_type,result.applied_date,to_jsonb(result));
  return result;
end $$;

create or replace function public.assert_application_owner(actor_id text, target_id uuid)
returns void language plpgsql stable security definer set search_path=public as $$
begin
  if not exists(select 1 from applications where id=target_id and owner_id=actor_id) then
    raise exception using errcode='P0002',message='application_not_found';
  end if;
end $$;
