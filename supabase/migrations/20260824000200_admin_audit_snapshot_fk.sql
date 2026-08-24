-- Preserve append-only semantics while allowing the database's own FK action to
-- clear deleted identity references. Snapshots and every other audit field stay
-- immutable, and a direct UPDATE still runs at trigger depth 1 and is rejected.
create or replace function public.prevent_admin_audit_mutation()
returns trigger language plpgsql as $$
begin
  if tg_op='UPDATE'
    and pg_trigger_depth()>1
    and (new.actor_id is null or new.actor_id is not distinct from old.actor_id)
    and (new.target_user_id is null or new.target_user_id is not distinct from old.target_user_id)
    and (to_jsonb(new)-'actor_id'-'target_user_id') =
        (to_jsonb(old)-'actor_id'-'target_user_id') then
    return new;
  end if;
  raise exception 'admin_audit_events are append-only';
end $$;
