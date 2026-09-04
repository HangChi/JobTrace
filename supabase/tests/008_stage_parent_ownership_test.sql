begin;

select plan(7);

insert into users(id,display_name,email)
values ('stage-parent-owner','Stage Parent Owner','stage-parent-owner@example.test');

select public.create_application_for_owner(
  'stage-parent-owner',
  '{"companyName":"Stage Parent A","positionName":"Engineer","appliedDate":"2026-08-01"}'::jsonb
);
select public.create_application_for_owner(
  'stage-parent-owner',
  '{"companyName":"Stage Parent B","positionName":"Engineer","appliedDate":"2026-08-01"}'::jsonb
);
select public.add_stage_occurrence_for_owner(
  'stage-parent-owner',
  (select id from applications where company_name='Stage Parent A'),
  'interview_1',
  '2026-08-05'
);

select throws_ok(
  format(
    $sql$select public.remove_stage_occurrence_for_owner('stage-parent-owner',%L,%L,'2026-08-13')$sql$,
    (select id from applications where company_name='Stage Parent B'),
    (select id from application_stage_occurrences where stage='interview_1')
  ),
  'P0002',
  'stage_not_found',
  'a stage cannot be removed through another application id'
);
select is(
  (select count(*) from application_stage_occurrences where stage='interview_1'),
  1::bigint,
  'the mismatched stage remains'
);
select is(
  (select version from applications where company_name='Stage Parent A'),
  2,
  'the owning application version is unchanged after rejection'
);
select is(
  (select count(*) from application_events where type='stage_removed'),
  0::bigint,
  'the rejected removal writes no event'
);
select lives_ok(
  format(
    $sql$select public.remove_stage_occurrence_for_owner('stage-parent-owner',%L,%L,'2026-08-13')$sql$,
    (select id from applications where company_name='Stage Parent A'),
    (select id from application_stage_occurrences where stage='interview_1')
  ),
  'the stage can be removed through its owning application id'
);
select is(
  (select count(*) from application_stage_occurrences where stage='interview_1'),
  0::bigint,
  'the matching stage is removed'
);
select is(
  (select count(*) from application_events where type='stage_removed'),
  1::bigint,
  'the matching removal writes one event'
);

select * from finish();
rollback;
