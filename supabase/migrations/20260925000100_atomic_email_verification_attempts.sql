create or replace function public.verify_email_code_attempt(
  target_email text,
  target_purpose text,
  target_user_id text,
  submitted_code_hash text
) returns table(code_id uuid, matched boolean)
language plpgsql
set search_path = public
as $$
declare
  candidate public.email_verification_codes%rowtype;
begin
  select verification.* into candidate
  from public.email_verification_codes verification
  where lower(verification.email) = lower(target_email)
    and verification.purpose = target_purpose
    and verification.user_id is not distinct from target_user_id
    and verification.consumed_at is null
    and verification.expires_at > now()
    and verification.attempt_count < 5
  order by verification.created_at desc
  limit 1
  for update;

  if not found then
    return;
  end if;

  code_id := candidate.id;
  matched := candidate.code_hash = submitted_code_hash;

  if matched then
    update public.email_verification_codes
    set consumed_at = now()
    where id = candidate.id;
  else
    update public.email_verification_codes
    set attempt_count = attempt_count + 1
    where id = candidate.id;
  end if;

  return next;
end
$$;

comment on function public.verify_email_code_attempt(text,text,text,text) is
  'Serializes verification attempts and atomically consumes a matching code.';
