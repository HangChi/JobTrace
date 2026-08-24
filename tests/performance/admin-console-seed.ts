type UnsafeSql = { unsafe: (query: string) => Promise<unknown> };

export async function seedAdminConsolePerformance(sql: UnsafeSql) {
  await sql.unsafe(`
    insert into users(id,display_name,email,email_verified,role,disabled,username,display_username,access_version,created_at,updated_at)
    select 'admin-perf-user-' || lpad(n::text,5,'0'),'Admin Perf ' || n,
      'admin-perf-' || n || '@example.test',true,
      case when n % 101=0 then 'admin' else 'user' end,n % 50=0,
      'admin_perf_' || n,'admin_perf_' || n,1,
      now()-(n % 120) * interval '1 day',now()
    from generate_series(1,10000) n
  `);
  await sql.unsafe(`
    insert into sessions(id,expires_at,token,created_at,updated_at,user_id)
    select 'admin-perf-session-' || n,now()+interval '1 day','admin-perf-token-' || n,
      now()-(n % 30)*interval '1 day',now(),'admin-perf-user-' || lpad(n::text,5,'0')
    from generate_series(1,10000) n where n % 3=0
  `);
  await sql.unsafe(`
    insert into applications(owner_id,company_name,position_name,applied_date,status,latest_date)
    select 'admin-perf-user-' || lpad(n::text,5,'0'),'Admin Perf Company ' || (n % 500),
      'Role ' || (n % 100),current_date-(n % 90),'submitted',current_date-(n % 90)
    from generate_series(1,10000) n
  `);
  await sql.unsafe(`
    insert into admin_audit_events(
      request_id,request_fingerprint,actor_id,actor_identifier_snapshot,
      target_user_id,target_identifier_snapshot,event_type,outcome,reason,
      before_data,after_data,created_at
    )
    select gen_random_uuid(),md5('admin-perf-' || n),
      'admin-perf-user-00101','admin_perf_101',
      'admin-perf-user-' || lpad(((n % 10000)+1)::text,5,'0'),
      'admin_perf_' || ((n % 10000)+1),
      (array['promote_admin','demote_admin','disable_user','enable_user'])[(n % 4)+1],
      (array['succeeded','denied','conflict','failed'])[(n % 4)+1],
      'Deterministic administrator performance audit reason.',
      '{"role":"user","disabled":false,"accessVersion":1}'::jsonb,
      '{"role":"user","disabled":true,"accessVersion":2}'::jsonb,
      now()-(n % 120)*interval '1 day'
    from generate_series(1,100000) n
  `);
}
