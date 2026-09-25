alter function public.change_user_access_as(
  text,text,uuid,bigint,text,text,boolean
) rename to change_user_access_as_without_request_lock;

create function public.change_user_access_as(
  actor text,
  target text,
  command_request_id uuid,
  expected_version bigint,
  command_action text,
  command_reason text,
  confirm_self boolean default false
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
begin
  -- The existing implementation checks the audit row before locking users. Lock
  -- the idempotency key first so a concurrent retry performs that lookup only
  -- after the first transaction has committed its result.
  perform pg_advisory_xact_lock(
    hashtextextended('admin-access-request:' || command_request_id::text,0)
  );

  return public.change_user_access_as_without_request_lock(
    actor,target,command_request_id,expected_version,command_action,
    command_reason,confirm_self
  );
end;
$$;

revoke execute on function public.change_user_access_as_without_request_lock(
  text,text,uuid,bigint,text,text,boolean
) from public;
revoke execute on function public.change_user_access_as(
  text,text,uuid,bigint,text,text,boolean
) from public;

comment on function public.change_user_access_as(
  text,text,uuid,bigint,text,text,boolean
) is
  'Serializes each administrator access-change request ID before idempotency lookup and atomically returns the original result to concurrent retries.';
