# Data Model: 管理员后台增强

## Conventions

- 现有 Better Auth 用户主键继续使用 `text`；审计事件与幂等请求 ID 使用 UUID。
- 系统时间使用 `timestamptz`；注册筛选的自然日边界按 `Asia/Shanghai` 转换为时间区间。
- 稳定代码、动作与结果保存英文值，中文仅在展示层映射。
- 管理查询默认按 `created_at desc, id desc` 稳定排序；页码从 1 开始，每页 1–100 条，默认 50 条。
- 所有账号访问变更均使用 `access_version` 乐观并发和唯一 `request_id` 幂等控制。
- 管理员 DTO 采用字段白名单，不得通过 `select *` 或完整业务实体序列化到页面/HTTP 边界。

## Enumerations

### admin_access_action

- `promote_admin`：普通用户提升为管理员。
- `demote_admin`：管理员降为普通用户。
- `disable_user`：禁用当前有效账号并撤销全部 Session。
- `enable_user`：重新启用已禁用账号，不恢复旧 Session。

一个命令只能包含一个动作。动作与当前状态不匹配时返回确定性冲突，不执行无变化写入。

### admin_action_outcome

- `succeeded`：状态已变化，成功审计与状态同一事务提交。
- `denied`：被最后管理员或自我确认等业务保护规则拒绝。
- `conflict`：预期版本过期、动作与当前状态不匹配或请求 ID 被不同载荷占用。
- `failed`：命令已被接受，但在仍可写审计的边界内发生非业务失败。

数据库完全不可用等无法持久化审计的故障以去敏结构化服务日志记录；使用相同 `request_id` 重试以确定最终状态。

## Existing Entity Extension: users

现有认证用户表继续是账号角色和禁用状态的事实来源。

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `id` | text | yes | 现有主键 |
| `username` | text | yes for managed accounts | 唯一；管理员检索字段 |
| `display_username` | text | no | 展示用账号名 |
| `email` | text | yes | 唯一内部邮箱；管理员检索字段 |
| `role` | text | yes | `user` 或 `admin` |
| `disabled` | boolean | yes | 默认 false |
| `access_version` | bigint | yes | 新增；默认 1，必须 >0；仅角色/禁用状态成功变化时 +1 |
| `created_at` | timestamptz | yes | 注册时间 |
| `updated_at` | timestamptz | yes | 任意用户资料更新时间；不得替代访问版本 |

**Access constraints**:

- 公开注册仍只能创建 `role=user, disabled=false, access_version=1`。
- 任何时刻至少保留一个 `role=admin AND disabled=false` 的账号。
- 只有原子管理函数可以改变角色/禁用状态并递增 `access_version`；普通资料更新不得改变访问版本。
- 禁用成功时同一事务删除该用户全部 `sessions`；启用不创建 Session。

**Indexes**:

- `lower(username)` 与 `lower(email)` 的 trigram 索引用于受控部分匹配。
- `(role, disabled, created_at desc, id desc)` 用于组合筛选。
- `(created_at desc, id desc)` 用于默认用户目录。
- `sessions(user_id, created_at desc)` 用于最近登录与活跃聚合。

## Entity: admin_audit_events

对每次已授权且结构有效的访问变更命令形成只追加历史。迁移扩展现有表并回填已有事件。

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `id` | uuid | yes | 主键 |
| `request_id` | uuid | yes | 全表唯一；幂等键；旧事件迁移时生成 |
| `request_fingerprint` | text | yes | 目标、动作、原因、预期版本与自我确认标志的稳定摘要；不得包含原始凭据 |
| `actor_id` | text | no | FK → users，删除时 SET NULL |
| `actor_identifier_snapshot` | text | yes | 事件时用户名或内部邮箱快照，1–320 字符 |
| `target_user_id` | text | no | FK → users，删除时 SET NULL |
| `target_identifier_snapshot` | text | yes | 事件时目标账号快照，1–320 字符 |
| `event_type` | admin_access_action | yes | 本次单一动作 |
| `outcome` | admin_action_outcome | yes | 结果 |
| `reason` | text | yes | trim 后 10–500 字符；仅审计和受权 UI 可见，不写服务日志 |
| `before_data` | jsonb | yes | 仅包含 `role`、`disabled`、`accessVersion` |
| `after_data` | jsonb | no | 成功后状态；拒绝/失败可与 before 相同或为空 |
| `failure_code` | text | no | 稳定错误代码，最长 100；成功为空 |
| `created_at` | timestamptz | yes | 数据库生成；事件时间 |

**Constraints**:

- `(request_id)` 唯一。同一请求 ID 与相同指纹重试读取原事件；不同指纹产生 `idempotency_conflict`，不得覆盖原事件。
- `succeeded` 必须有 `after_data` 且访问版本恰好增加 1；非成功结果不得改变用户或 Session。
- `before_data`/`after_data` 只允许访问状态白名单，不得存储密码、Cookie、token、IP、user-agent、简历、备注或面经正文。
- UPDATE 和 DELETE 继续由数据库触发器拒绝；后台接口只公开 GET。
- 用户删除后外键置空，但身份快照、事件内容和顺序保留。

**Indexes**:

- `(created_at desc, id desc)` 用于默认审计列表。
- `(actor_id, created_at desc, id desc)`、`(target_user_id, created_at desc, id desc)` 用于账号筛选。
- `(event_type, outcome, created_at desc, id desc)` 用于类型/结果组合筛选。
- `request_id` 唯一索引用于幂等重放。

## Derived Entity: Managed User Summary

用户目录的只读 DTO，不单独持久化。

| Field | Source | Rules |
|-------|--------|-------|
| `id` | users.id | text |
| `username` | display_username/username | 仅账号标识 |
| `internalEmail` | users.email | 仅管理员可见 |
| `role` / `disabled` / `accessVersion` | users | 当前访问状态 |
| `createdAt` | users.created_at | ISO 时间 |
| `lastSignInAt` | max(sessions.created_at) | 无 Session 时 null |
| `applicationCount` | count(applications.owner_id) | 非负整数，仅数量 |
| `interviewCount` | count(interview_reviews.owner_id) | 非负整数，仅数量 |

列表查询应先分页用户，再以分页内用户 ID 聚合业务数量，避免把多个一对多关系直接连接后造成笛卡尔计数膨胀。

## Derived Entity: Managed User Detail

在 Managed User Summary 基础上增加最多 10 条最近审计摘要；不返回业务记录正文、问题、回答、备注、附件、Session 或设备信息。目标不存在返回 404；存在但已被其他管理员变更时读取最新 `accessVersion`。

## Derived Entity: Operational Summary

请求时生成，不单独持久化。

| Section | Fields | Definition |
|---------|--------|------------|
| `counts` | users, activeUsers, disabledUsers, administrators, applications, interviews | 当前全局计数；activeUsers 指未禁用用户 |
| `activityWindows` | registered7d, active7d, registered30d, active30d | 窗口含当前业务日；活跃为窗口内至少创建一次 Session 的不同未禁用用户 |
| `dailyTrend` | date, registeredUsers, activeUsers | 最近 30 个 `Asia/Shanghai` 自然日，缺失日期补零 |
| metadata | generatedAt, timeZone, definition | 明确生成时间、时区和活跃口径 |

每个摘要 section 带 `available` 或 `unavailable` 状态。`available` 且值为 0 表示真实零值；`unavailable` 不得伪装成零。全库不可访问时整个请求返回错误。

## Atomic access-change lifecycle

```text
received
  ├─ invalid/unauthorized ──> HTTP error（不进入受信管理命令）
  └─ accepted
       ├─ existing request_id + same fingerprint ──> replay prior outcome
       ├─ existing request_id + different fingerprint ──> conflict
       └─ lock actor + target
            ├─ stale version/action mismatch ──> audit conflict, no state change
            ├─ self confirmation missing ──────> audit denied, no state change
            ├─ last active admin risk ─────────> audit denied, no state change
            └─ allowed
                 ├─ update role/disabled + access_version
                 ├─ delete target sessions when disabling
                 └─ append succeeded audit
```

自我禁用/降级成功后，目标即当前 actor，其所有 Session 在事务内删除；当前响应可以完成，但下一次受保护请求必须为未登录状态。

## State transitions

| Current | Action | Result | Guard |
|---------|--------|--------|-------|
| user + active | promote_admin | admin + active | expected version matches |
| admin + active | demote_admin | user + active | another effective admin remains; self requires confirmation |
| user/admin + active | disable_user | same role + disabled | if admin, another effective admin remains; self requires confirmation; delete sessions |
| user/admin + disabled | enable_user | same role + active | no old Session restored |
| already target state | corresponding action | conflict | no version increment |
| any | stale expected version | conflict | return latest safe state metadata |

## Validation and error mapping

- Invalid query, date range, page/limit, UUID, action, reason or expected version: `validation` (400) with field errors.
- Missing Session: `unauthorized` (401); disabled/non-admin actor: `forbidden` (403).
- Target user missing: `not_found` (404); response does not expose unrelated sensitive fields.
- Stale access version: `access_version_conflict` (409).
- Last effective administrator guard: `last_admin` (409).
- Missing self confirmation: `self_confirmation_required` (409).
- Reused request ID with different fingerprint: `idempotency_conflict` (409).
- Same request ID and fingerprint: replay prior result with `replayed=true`; never repeat the state transition.
