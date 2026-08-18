# Data Model: 面试面经记录与复盘

## Conventions

- 主键使用 UUID；用户业务日期使用 `date`；系统时间使用 `timestamptz`。
- 稳定枚举保存英文代码，中文仅在展示层映射。
- 所有可编辑文本保存前去除首尾空白；空白文本按 null/未填写处理。
- 所有面经、问题和行动项通过面经 owner 与投递 owner 保持一致；普通用户查询必须带 owner 条件。
- 聚合更新使用 `version` 乐观并发控制；版本不匹配返回冲突，不覆盖后来保存的数据。

## Enumerations

### interview_format

- `online`：线上
- `offline`：线下
- `phone`：电话

可为空，表示用户没有记录形式。

### round_result

- `pending`：待反馈
- `passed`：通过
- `failed`：未通过

默认 `pending`，只描述本轮面试，不改变投递状态。

### review_status

- `draft`：草稿，基础记录或问题仍在填写
- `pending_review`：待复盘，已有面试内容但还未形成改进闭环
- `completed`：已完成，满足完成条件并由用户确认

### question_category

- `technical`：技术基础
- `project`：项目经历
- `behavioral`：行为面试
- `system_design`：系统设计
- `other`：其他

## Entity: interview_reviews

一次具体面试的个人记录，必须属于一条投递。

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `id` | uuid | yes | 主键 |
| `owner_id` | uuid/text | yes | 认证用户；必须等于关联投递 owner |
| `application_id` | uuid | yes | FK → applications；删除投递时级联删除 |
| `stage_occurrence_id` | uuid | no | FK → application_stage_occurrences；删除阶段时 SET NULL；非空时唯一 |
| `stage_snapshot` | recruitment_stage | yes | 创建时复制阶段类型；只允许 interview_1/interview_2/interview_3/hr_interview/final_interview |
| `interviewed_on` | date | yes | 不早于投递日期，不晚于当前业务日期；解除关联后保留快照 |
| `format` | interview_format | no | 线上/线下/电话 |
| `duration_minutes` | integer | no | 1–600 |
| `interviewer_notes` | text | no | 最长 2,000 字符 |
| `round_result` | round_result | yes | 默认 pending |
| `highlights` | text | no | 最长 10,000 字符 |
| `gaps` | text | no | 最长 10,000 字符 |
| `status` | review_status | yes | 默认 draft |
| `version` | integer | yes | 默认 1；每次成功聚合更新递增 |
| `created_at` | timestamptz | yes | 数据库生成 |
| `updated_at` | timestamptz | yes | 聚合更新时刷新 |

**Constraints**:

- `stage_occurrence_id` 非空时必须属于同一 `application_id` 和 `owner_id`。
- 同一阶段发生记录最多一篇面经。
- `completed` 只有在至少一条问题记录，且存在复盘后的回答、待改进点或行动项时允许设置。
- 面经状态与投递状态独立；不得由 round_result 自动修改 applications.status。

**Indexes**:

- `(owner_id, interviewed_on desc, id)` 用于默认列表。
- `(owner_id, status, interviewed_on desc, id)` 用于状态筛选。
- `(owner_id, stage_snapshot, interviewed_on desc, id)` 用于轮次筛选。
- `(application_id, interviewed_on desc, id)` 用于投递详情。
- `stage_occurrence_id` unique partial index where not null。
- 对公司/岗位关联搜索通过 applications 的既有搜索索引；问题全文搜索使用面经 owner 范围内的可检索文本索引或受控 `LIKE` 查询，具体实现以性能测试结果为准。

## Entity: interview_questions

一篇面经中的问题及回答，属于一个面经聚合。

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `id` | uuid | yes | 主键 |
| `interview_review_id` | uuid | yes | FK → interview_reviews，删除级联 |
| `sort_order` | integer | yes | 聚合内唯一、从 0 开始的连续顺序 |
| `category` | question_category | yes | 默认 other |
| `question` | text | yes | trim 后 1–4,000 字符 |
| `original_answer` | text | no | 最长 10,000 字符 |
| `follow_up_notes` | text | no | 最长 10,000 字符 |
| `improved_answer` | text | no | 最长 10,000 字符 |
| `self_rating` | integer | no | 1–5 |
| `created_at` | timestamptz | yes | 数据库生成 |
| `updated_at` | timestamptz | yes | 问题修改时刷新 |

排序通过同一聚合 PATCH 原子重排；不允许跨面经移动问题。

## Entity: interview_action_items

一篇面经产生的可执行改进事项。

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `id` | uuid | yes | 主键 |
| `interview_review_id` | uuid | yes | FK → interview_reviews，删除级联 |
| `content` | text | yes | trim 后 1–1,000 字符 |
| `completed` | boolean | yes | 默认 false |
| `sort_order` | integer | yes | 聚合内唯一、从 0 开始的连续顺序 |
| `created_at` | timestamptz | yes | 数据库生成 |
| `updated_at` | timestamptz | yes | 修改或勾选时刷新 |

## Relationships and lifecycle

```text
user 1 ── N applications 1 ── N stage_occurrences
                       └──── N interview_reviews 1 ── N interview_questions
                                               └──── N interview_action_items
```

- 一个投递可以有多篇面经；一个阶段发生记录最多一篇面经。
- 删除阶段 occurrence：面经保留，`stage_occurrence_id` 置空，`stage_snapshot` 和 `interviewed_on` 继续展示。
- 删除投递：面经、问题和行动项级联删除；删除确认必须明确告知用户。
- 创建未记录阶段的面经：在同一事务中写入 stage occurrence、面经及其初始事件。
- 阶段日期/类型修正：保留 occurrence ID；面经读取最新阶段展示值，但不改写历史快照。
- 面经内容更新：写入当前快照并递增 version；不把每次文字编辑写入投递事件历史。

## Validation and error mapping

- 无效 UUID、枚举、日期、长度、评分和状态转换：`validation`，带字段错误。
- 阶段不存在、跨投递或跨 owner：`not_found`，不泄露存在性。
- 同 occurrence 重复创建、版本冲突：`conflict`。
- 已删除投递、无关联阶段且未提供新阶段信息：`not_found` 或 `validation`，按请求上下文返回。
