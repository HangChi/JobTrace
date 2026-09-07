# Data Model: 查询性能渐进优化

## Existing entities

`applications`、`application_stage_occurrences`、`interview_reviews`、`interview_questions`、`interview_action_items`、`job_market_companies`、`job_market_campaigns`、`job_market_posts`、`job_market_sources` 和 owner-scoped 私人关系保持现有所有权与约束。

## Job market company read model

`job_market_company_read_models` 是可重建的公共查询投影，不是新的业务权威来源。

| Field | Meaning | Rules |
|---|---|---|
| `company_id` | 公司 | 引用公共公司，删除时级联删除 |
| `include_closed` | 摘要是否包含已关闭内容 | 与公司组成联合主键 |
| `representative_campaign_id` | 稳定的列表记录标识 | 可空；指向代表招聘活动 |
| `listing_kind` / `recruitment_type` | 展示类型 | 与现有公司聚合口径一致 |
| `positions` / `position_count` | 岗位名称集合和去重数 | 只来自对应模式下可见的活动来源；普通列表最多传输前 50 个稳定排序名称，详情保持完整集合 |
| `locations` | 去重的地点摘要 | JSON 数组，名称稳定排序 |
| `status` | 公司聚合状态 | open 优先，其次 stale，否则 closed |
| `primary_apply_url` / `source_*` | 列表直接入口和来源 | 优先激活的官方同步来源，再使用目录入口 |
| `published_at` / `valid_through` / `last_confirmed_at` | 聚合时间 | 使用可见记录的最新/最大值 |
| `search_text` / `location_text` | 规范化查询文本 | 仅含公共内容，可重建 |
| `refreshed_at` | 投影刷新时间 | 用于诊断，不改变业务新鲜度口径 |

## Relationships and lifecycle

- 每个公司最多有两条投影：排除 closed 与包含 closed。
- 成功同步在修改规范化岗位后、释放租约前，在同一事务内刷新影响公司的两条投影。
- 来源启用/暂停/撤销和目录更新必须刷新影响公司。
- 投影是可丢弃投影；任何时候都可从规范化公共表全量重建。
- 收藏、已记录投递和其他 owner 状态不得出现在投影中。
