# Data Model: 职迹简历投递管理

## Conventions

- 主键使用 UUID；系统时间使用 `timestamptz`；用户业务日期使用 `date`。
- 状态、阶段和事件类型存稳定英文代码，中文标签由应用展示层映射。
- 所有可编辑文本保存前去除首尾空白；公司/岗位另维护数据库生成或写入的标准化搜索值。
- 数据库是完整性最终防线；相同规则在 TypeScript 领域层和请求 schema 中提前反馈。
- 首期只有一个安装级 owner。业务表不向 Supabase `anon`/`authenticated` 角色开放，由 Next.js 服务端访问。

## Enumerations

### application_status

| Code | 中文标签 | 分类 |
|------|----------|------|
| `planned` | 待投递 | 活跃 |
| `active` | 进行中 | 活跃、可跟进 |
| `rejected` | 拒绝 | 结束 |
| `offer` | Offer | 活跃、可跟进 |
| `accepted` | 已接受 | 结束 |
| `withdrawn` | 已放弃 | 结束 |
| `no_response` | 无反馈 | 结束 |

### recruitment_stage

`screening`（初筛）、`assessment`（测评）、`written_test`（笔试）、`interview_1`（一面）、`interview_2`（二面）、`interview_3`（三面）、`hr_interview`（HR 面）、`final_interview`（终面）。

### application_event_type

`created`、`details_changed`、`status_changed`、`stage_added`、`stage_removed`、`imported`。

## Entity: applications

投递聚合的当前快照，用于列表、详情和统计。

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `id` | uuid | yes | 主键 |
| `company_name` | varchar(200) | yes | trim 后 1–200 字符 |
| `company_name_search` | text | yes | 公司名的大小写无关标准化值；仅内部使用 |
| `position_name` | varchar(200) | yes | trim 后 1–200 字符 |
| `position_name_search` | text | yes | 岗位名的大小写无关标准化值；仅内部使用 |
| `city` | varchar(100) | no | trim 后 1–100 字符 |
| `job_url` | text | no | 绝对 `http`/`https` URL，最长 2048 字符 |
| `applied_date` | date | yes | 不晚于当前业务日期 |
| `status` | application_status | yes | 默认 `planned` |
| `latest_date` | date | yes | `>= applied_date`，创建时等于投递日期 |
| `notes` | text | no | 最长 10,000 字符 |
| `created_at` | timestamptz | yes | 数据库生成 |
| `updated_at` | timestamptz | yes | 每次当前快照改变时更新 |
| `version` | integer | yes | 默认 1，乐观并发控制，每次更新递增 |

### Derived values

- `is_closed`: `status` ∈ rejected, accepted, withdrawn, no_response。
- `needs_follow_up`: `status` ∈ active, offer 且 `current_business_date - latest_date >= 7`。
- `follow_up_days`: 当前业务日期与 `latest_date` 的自然日差。
- `candidate_duplicate_key`: 标准化公司名 + 标准化岗位名 + `applied_date`；只提示，不建立唯一约束。

### Indexes

- GIN trigram: `company_name_search`, `position_name_search`。
- B-tree: `(status, latest_date desc, id)`、`(applied_date desc, id)`、`(city)`。
- 默认列表游标使用稳定元组 `(is_closed, latest_date desc, id)` 的等价排序表达式。

## Entity: application_stage_occurrences

记录每次实际发生的招聘环节；同类阶段允许在不同日期重复发生。

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `id` | uuid | yes | 主键 |
| `application_id` | uuid | yes | FK → applications，删除级联 |
| `stage` | recruitment_stage | yes | 标准阶段代码 |
| `occurred_on` | date | yes | `>= application.applied_date` 且不晚于当前业务日期 |
| `created_at` | timestamptz | yes | 数据库生成 |

**Relationship**: application 1:N stage occurrences。列表的“已达阶段”对 `stage` 去重；历史保留全部 occurrence。

**Index**: `(application_id, occurred_on desc, id)`、`(stage, application_id)`。

## Entity: application_events

追加式审计轨迹，不允许通过常规应用用例修改或删除。

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `id` | uuid | yes | 主键 |
| `application_id` | uuid | yes | FK → applications，删除级联（随用户明确删除整条记录） |
| `event_type` | application_event_type | yes | 稳定事件代码 |
| `occurred_on` | date | yes | 业务发生日期，`>= applied_date` |
| `before_data` | jsonb | no | 仅受影响字段的旧值；created/imported 可为空 |
| `after_data` | jsonb | yes | 仅受影响字段的新值或事件摘要 |
| `created_at` | timestamptz | yes | 实际写入时间 |

**Index**: `(application_id, occurred_on desc, created_at desc, id)`。

## Entity: import_batches

导入预检和确认的短期状态，默认创建 24 小时后过期。

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `id` | uuid | yes | 主键 |
| `file_name` | varchar(255) | yes | 仅清理后的基本文件名 |
| `format` | text | yes | `csv` 或 `xlsx` |
| `status` | text | yes | `previewed`, `processing`, `completed`, `expired` |
| `column_mapping` | jsonb | yes | 原列名到支持字段的映射 |
| `total_rows` | integer | yes | 1–10,000 |
| `valid_rows` | integer | yes | 非负，不能大于总数 |
| `invalid_rows` | integer | yes | 非负，不能大于总数 |
| `duplicate_rows` | integer | yes | 非负，属于有效行子集 |
| `created_at` | timestamptz | yes | 数据库生成 |
| `expires_at` | timestamptz | yes | 默认 `created_at + 24 hours` |
| `completed_at` | timestamptz | no | 确认结束时写入 |

## Entity: import_rows

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `id` | uuid | yes | 主键 |
| `batch_id` | uuid | yes | FK → import_batches，删除级联 |
| `row_number` | integer | yes | 原文件行号；批次内唯一 |
| `normalized_data` | jsonb | no | 通过字段级解析后的候选记录 |
| `errors` | jsonb | yes | 字段、代码和可读信息数组；默认 `[]` |
| `duplicate_application_ids` | uuid[] | yes | 候选重复记录；默认空数组 |
| `decision` | text | no | `import`, `skip`；无效行只能 skip |
| `result` | text | no | `created`, `skipped`, `failed` |
| `application_id` | uuid | no | 成功创建后的记录 ID |

**Constraints**: unique `(batch_id, row_number)`；一个批次最多 10,000 行。

## Aggregate and Transaction Rules

1. 创建投递时在同一事务写入 `applications` 和 `created`/`imported` 事件。
2. 更新请求携带 `version`；版本不匹配返回 conflict，不覆盖后来修改。
3. 业务字段变化写入 `details_changed`；状态变化写入 `status_changed`。一次请求可产生多类事件，但 `latest_date` 取本次有效变化日期最大值。
4. 添加阶段时写入 occurrence 和 `stage_added` 事件；移除列表中的某次 occurrence 写 `stage_removed`，历史事件仍保留。
5. 删除是用户确认后的硬删除，级联清理阶段和事件。首期不承诺恢复。
6. 导入确认按行隔离：单行的应用和事件原子写入；单行失败不回滚其他成功行，最终汇总必须与行结果一致。
7. 统计从 applications 和去重阶段关联实时计算，不存储可漂移的计数器。

## State Transitions

所有状态之间均允许人工转换，以支持现实中的重新开启或纠正；每次转换必须：

1. 校验变化日期不早于 `applied_date` 且不晚于当前业务日期；
2. 追加 `status_changed` 事件（相同状态不产生事件）；
3. 更新 `latest_date` 和 `updated_at`；
4. 递增 `version`；
5. 立即通过派生规则重新计算是否需跟进。

## Retention and Privacy

- 投递、阶段和事件持续保留，直到用户删除投递。
- 导入批次和行在 24 小时后可清理；不保留上传的二进制原文件。
- 日志不得包含 notes、完整文件行或密钥；必要时只记录 application/batch ID、行数和错误代码。
