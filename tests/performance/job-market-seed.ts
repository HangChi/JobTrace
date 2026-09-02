type UnsafeSql = { unsafe: (query: string) => Promise<unknown> };

export async function seedJobMarketPerformance(sql: UnsafeSql) {
  await sql.unsafe(`
    insert into users(id,display_name,email,email_verified,role,username,display_username)
    values('job-market-perf-owner','Job Market Perf','job-market-perf@example.test',true,'user','job_market_perf','job_market_perf')
  `);
  await sql.unsafe(`
    insert into job_market_companies(id,canonical_name,normalized_name,identity_key,company_type,industry)
    select ('10000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
      'Performance Company ' || lpad(n::text,3,'0'),
      'performance company ' || lpad(n::text,3,'0'),
      'job-market-performance-' || n,'private','software'
    from generate_series(1,100) n
  `);
  await sql.unsafe(`
    insert into job_market_sources(id,company_id,adapter,external_key,base_url,allowed_hosts,access_basis,status,next_sync_at,last_success_at)
    select ('20000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
      ('10000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
      'greenhouse','perf-source-' || n,'https://jobs.example.com',array['jobs.example.com'],'public','active',now()-interval '1 hour',now()
    from generate_series(1,100) n
  `);
  await sql.unsafe(`
    insert into job_market_campaigns(id,company_id,campaign_key,name,recruitment_type,status,last_confirmed_at)
    select ('30000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
      ('10000000-0000-4000-8000-' || lpad((((n-1)/10)+1)::text,12,'0'))::uuid,
      'performance-campaign-' || n,'2027 Campus','campus','open',now()
    from generate_series(1,1000) n
  `);
  await sql.unsafe(`
    insert into job_market_posts(id,company_id,campaign_id,title,normalized_title,recruitment_type,status,content_hash,primary_apply_url,last_seen_at)
    select ('40000000-0000-4000-' || lpad(((n-1)/1000+8000)::text,4,'0') || '-' || lpad(n::text,12,'0'))::uuid,
      ('10000000-0000-4000-8000-' || lpad((((n-1)/1000)+1)::text,12,'0'))::uuid,
      ('30000000-0000-4000-8000-' || lpad((((n-1)/100)+1)::text,12,'0'))::uuid,
      'Performance Role ' || (n % 1000),'performance role ' || (n % 1000),'campus','open',
      md5('job-market-post-' || n) || md5('job-market-post-' || n),
      'https://jobs.example.com/apply/' || n,now()
    from generate_series(1,100000) n
  `);
  await sql.unsafe(`
    insert into job_market_source_records(source_id,external_job_id,post_id,external_apply_url,payload_hash)
    select ('20000000-0000-4000-8000-' || lpad((((n-1)/1000)+1)::text,12,'0'))::uuid,
      'performance-job-' || n,
      ('40000000-0000-4000-' || lpad(((n-1)/1000+8000)::text,4,'0') || '-' || lpad(n::text,12,'0'))::uuid,
      'https://jobs.example.com/apply/' || n,
      md5('job-market-post-' || n) || md5('job-market-post-' || n)
    from generate_series(1,100000) n
  `);
}
