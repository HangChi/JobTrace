-- The original Xiaomi adapter consumed the global "all cities" response.
-- Close legacy records that have no mainland-China location; the adapter now
-- applies the same fail-closed location scope before persisting new records.
with mainland_names(name) as (
  select unnest(array[
    '三亚','三明','上海','上饶','东莞','东营','中山','临汾','临沂','乌鲁木齐','乐山','九江','云浮','仙桃',
    '佛山','保定','信阳','兰州','内江','凉山','包头','北京','北海','南京','南充','南宁','南平','南昌','南通',
    '南阳','厦门','合肥','吉林','吕梁','呼和浩特','咸阳','哈尔滨','唐山','商丘','嘉兴','四平','大同','大庆',
    '大连','天津','太原','威海','娄底','宁德','宁波','安康','宜宾','宜昌','宜春','宝鸡','宿迁','岳阳','巴中',
    '常州','常德','广元','广安','广州','廊坊','延安','延边','张家界','徐州','德州','德阳','忻州','怀化','惠州',
    '成都','扬州','拉萨','揭阳','攀枝花','新乡','新余','无锡','日照','昆明','朔州','杭州','松原','枣庄','柳州',
    '株洲','桂林','梅州','榆林','武汉','永州','汉中','汕头','汕尾','江门','沈阳','河源','泉州','泰安','泰州',
    '泸州','洛阳','济南','济宁','海口','淄博','淮安','深圳','清远','温州','渭南','湘潭','湘西','湛江','滨州',
    '漳州','潍坊','烟台','玉林','珠海','琼海','白城','白山','百色','益阳','盐城','眉山','石家庄','福州','绍兴',
    '绵阳','聊城','肇庆','自贡','芜湖','苏州','莆田','菏泽','衡阳','襄阳','西宁','西安','许昌','贵港','贵阳',
    '资阳','赣州','赤峰','辽源','达州','运城','连云港','通化','遂宁','邯郸','邵阳','郑州','郴州','鄂尔多斯',
    '重庆','银川','镇江','长春','长沙','阳江','阳泉','雅安','青岛','韶关','龙岩'
  ]::text[])
), overseas_posts as (
  select distinct post.id, record.source_id, post.campaign_id
  from public.job_market_posts post
  join public.job_market_source_records record on record.post_id = post.id
  join public.job_market_sources source on source.id = record.source_id
  where source.adapter = 'xiaomi'
    and not exists (
      select 1
      from public.job_market_post_locations post_location
      join public.job_market_locations location on location.id = post_location.location_id
      where post_location.post_id = post.id
        and regexp_replace(trim(location.display_name), '(市|自治州|地区|盟)$', '')
          in (select name from mainland_names)
    )
), closed_posts as (
  update public.job_market_posts post
  set status = 'closed',
      missing_since = coalesce(post.missing_since, now()),
      last_missing_success_at = now(),
      updated_at = now()
  from overseas_posts overseas
  where post.id = overseas.id and post.status <> 'closed'
  returning post.id
), closed_records as (
  update public.job_market_source_records record
  set status = 'closed'
  from overseas_posts overseas
  where record.source_id = overseas.source_id and record.post_id = overseas.id
  returning record.post_id
), recorded_events as (
  insert into public.job_market_events(post_id,campaign_id,source_id,event_type,reason_code,change_summary)
  select overseas.id, overseas.campaign_id, overseas.source_id, 'closed',
    'china_scope_migration', '{"scope":"mainland_china"}'::jsonb
  from overseas_posts overseas
  join closed_posts closed on closed.id = overseas.id
  returning campaign_id
)
update public.job_market_campaigns campaign
set status = case
      when exists (
        select 1 from public.job_market_posts post
        where post.campaign_id = campaign.id and post.status = 'open'
      ) then 'open'::public.job_market_post_status
      when exists (
        select 1 from public.job_market_posts post
        where post.campaign_id = campaign.id and post.status = 'stale'
      ) then 'stale'::public.job_market_post_status
      else 'closed'::public.job_market_post_status
    end,
    updated_at = now()
where campaign.id in (select campaign_id from overseas_posts);
