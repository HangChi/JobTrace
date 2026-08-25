create or replace function public.confirm_import_batch_for_owner(
  actor_id text,
  target_batch_id uuid,
  decisions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  batch_row public.import_batches;
  decision_row record;
  created_application public.applications;
  results jsonb := '[]'::jsonb;
begin
  if actor_id is null or not exists(
    select 1 from public.users where id=actor_id and disabled=false
  ) then
    raise exception using errcode='42501',message='valid_actor_required';
  end if;

  select * into batch_row
  from public.import_batches
  where id=target_batch_id and owner_id=actor_id
  for update;
  if not found then
    raise exception using errcode='P0002',message='import_batch_not_found';
  end if;
  if batch_row.status <> 'previewed' or batch_row.expires_at <= now() then
    raise exception using errcode='40001',message='import_batch_conflict';
  end if;

  update public.import_batches set status='processing'
  where id=target_batch_id;

  for decision_row in
    with raw_decisions as (
      select
        (value->>'rowNumber')::integer as row_number,
        value->>'action' as action,
        ordinality
      from jsonb_array_elements(decisions) with ordinality requested(value,ordinality)
    ), requested_decisions as (
      select distinct on(row_number) row_number,action
      from raw_decisions
      order by row_number,ordinality
    )
    select import_row.*,coalesce(decision.action,'skip') as requested_action
    from public.import_rows import_row
    left join requested_decisions decision
      on decision.row_number=import_row.row_number
    where import_row.batch_id=target_batch_id
    order by import_row.row_number
  loop
    if decision_row.requested_action <> 'import'
      or jsonb_array_length(decision_row.errors) > 0
      or decision_row.normalized_data is null then
      update public.import_rows
      set decision='skip',result='skipped',application_id=null
      where batch_id=target_batch_id and row_number=decision_row.row_number;
      results := results || jsonb_build_array(jsonb_build_object(
        'rowNumber',decision_row.row_number,
        'result','skipped',
        'applicationId',null,
        'error',null
      ));
      continue;
    end if;

    begin
      select * into created_application
      from public.create_application_for_owner(
        actor_id,
        decision_row.normalized_data,
        'imported'
      );
      update public.import_rows
      set decision='import',result='created',application_id=created_application.id
      where batch_id=target_batch_id and row_number=decision_row.row_number;
      results := results || jsonb_build_array(jsonb_build_object(
        'rowNumber',decision_row.row_number,
        'result','created',
        'applicationId',created_application.id,
        'error',null
      ));
    exception when others then
      update public.import_rows
      set decision='import',result='failed',application_id=null
      where batch_id=target_batch_id and row_number=decision_row.row_number;
      results := results || jsonb_build_array(jsonb_build_object(
        'rowNumber',decision_row.row_number,
        'result','failed',
        'applicationId',null,
        'error',jsonb_build_object(
          'code','import_row_failed',
          'message','该行导入失败。',
          'requestId',''
        )
      ));
    end;
  end loop;

  update public.import_batches
  set status='completed',completed_at=now()
  where id=target_batch_id and owner_id=actor_id;
  return results;
end
$$;
