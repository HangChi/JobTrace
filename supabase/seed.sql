insert into public.users(id,display_name,email,email_verified,username,display_username)
values ('seed-user','示例用户','seed@users.jobtrace.local',true,'seed','seed')
on conflict (id) do nothing;

select public.create_application_for_owner('seed-user','{"companyName":"示例科技","positionName":"前端工程师","city":"上海","appliedDate":"2026-08-13","status":"submitted"}'::jsonb);
