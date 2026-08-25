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
  import_row public.import_rows;
  decision_action text;
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

  update public.import_batches
  set status='processing'
  where id=target_batch_id;

  for import_row in
    select *
    from public.import_rows
    where batch_id=target_batch_id
    order by row_number
  loop
    select coalesce(
      (
        select value->>'action'
        from jsonb_array_elements(decisions) value
        where (value->>'rowNumber')::integer=import_row.row_number
        limit 1
      ),
      'skip'
    ) into decision_action;

    if decision_action <> 'import'
      or jsonb_array_length(import_row.errors) > 0
      or import_row.normalized_data is null then
      update public.import_rows
      set decision='skip',result='skipped',application_id=null
      where batch_id=target_batch_id and row_number=import_row.row_number;
      results := results || jsonb_build_array(jsonb_build_object(
        'rowNumber',import_row.row_number,
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
        import_row.normalized_data,
        'imported'
      );
      update public.import_rows
      set decision='import',result='created',application_id=created_application.id
      where batch_id=target_batch_id and row_number=import_row.row_number;
      results := results || jsonb_build_array(jsonb_build_object(
        'rowNumber',import_row.row_number,
        'result','created',
        'applicationId',created_application.id,
        'error',null
      ));
    exception when others then
      update public.import_rows
      set decision='import',result='failed',application_id=null
      where batch_id=target_batch_id and row_number=import_row.row_number;
      results := results || jsonb_build_array(jsonb_build_object(
        'rowNumber',import_row.row_number,
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
