create or replace function public.remove_stage_occurrence_for_owner(
  actor_id text,
  target_id uuid,
  occurrence_id uuid,
  change_date date
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  old_row public.application_stage_occurrences;
begin
  delete from public.application_stage_occurrences stage
    using public.applications application
    where stage.id = occurrence_id
      and stage.application_id = target_id
      and application.id = target_id
      and application.owner_id = actor_id
    returning stage.* into old_row;

  if not found then
    raise exception using errcode = 'P0002', message = 'stage_not_found';
  end if;

  update public.applications
    set latest_date = greatest(latest_date, change_date),
        version = version + 1,
        updated_at = now()
    where id = target_id and owner_id = actor_id;

  insert into public.application_events(
    application_id,
    type,
    occurred_on,
    before,
    after
  ) values (
    target_id,
    'stage_removed',
    change_date,
    to_jsonb(old_row),
    '{}'::jsonb
  );
end
$$;

revoke execute on function public.remove_stage_occurrence_for_owner(
  text,
  uuid,
  uuid,
  date
) from public;

-- Keep the three-argument overload during the application rollback window.
-- Current code must use the parent-aware overload above.
revoke execute on function public.remove_stage_occurrence_for_owner(
  text,
  uuid,
  date
) from public;
