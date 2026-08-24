begin;
select plan(13);

select has_column('public','users','access_version','users expose access version');
select col_default_is('public','users','access_version','1::bigint','access version starts at one');
select col_not_null('public','users','access_version','access version is required');
select has_column('public','admin_audit_events','request_id','audit has idempotency key');
select has_column('public','admin_audit_events','request_fingerprint','audit has request fingerprint');
select has_column('public','admin_audit_events','actor_identifier_snapshot','audit preserves actor identity');
select has_column('public','admin_audit_events','target_identifier_snapshot','audit preserves target identity');
select has_column('public','admin_audit_events','outcome','audit records outcome');
select has_column('public','admin_audit_events','reason','audit records reason');
select has_index('public','admin_audit_events','admin_audit_request_id_idx','request id is unique indexed');
select has_function('public','change_user_access_as',array['text','text','uuid','bigint','text','text','boolean'],'atomic access function exists');

insert into users(id,display_name,email,role,username)
values ('admin-console-admin','Admin','admin-console-admin@example.test','admin','admin-console-admin'),
       ('admin-console-user','User','admin-console-user@example.test','user','admin-console-user');

select lives_ok(
  $$select public.change_user_access_as('admin-console-admin','admin-console-user','00000000-0000-4000-8000-000000000001',1,'promote_admin','Approved for operations',false)$$,
  'atomic access change succeeds'
);
select throws_ok(
  $$update admin_audit_events set reason='tampered' where request_id='00000000-0000-4000-8000-000000000001'$$,
  'admin_audit_events are append-only',
  'audit updates are rejected'
);

select * from finish();
rollback;
