# Implementation Plan: 职迹简历投递管理

**Branch**: `001-resume-application-tracking` | **Date**: 2026-08-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-resume-application-tracking/spec.md`

## Summary

构建一个支持账号与角色分流的求职投递 Web 应用：访客可注册普通账号，普通用户登录后直接访问且仅管理自己的投递数据，管理员登录后进入 `/admin` 管理后台。保留投递记录、状态历史、检索统计和 CSV/XLSX 导入导出能力。采用 Next.js App Router + TypeScript 模块化单体、自有 PostgreSQL 与 Better Auth；认证会话使用安全 Cookie，授权在页面、服务端入口和数据访问层纵深执行。

## Technical Context

**Language/Version**: TypeScript 5.x（strict）；Node.js 24 LTS

**Primary Dependencies**: Next.js 16.x App Router、React 19.x、Better Auth、`pg`、`postgres`、Zod、React Hook Form、SheetJS、date-fns

**Storage**: 用户自有 PostgreSQL；用户、Session、验证令牌、角色和业务数据均存入该库；SQL 迁移纳入版本控制

**Testing**: Vitest + Testing Library（单元/组件）、临时 PostgreSQL + SQL/Vitest/Playwright（数据库、集成与契约）、Playwright + axe（端到端与可访问性）

**Target Platform**: Node.js Web 运行时；Chrome、Edge、Firefox 当前及前一主要版本；桌面视口 ≥1280px，核心流程兼容较窄桌面窗口

**Project Type**: 服务端渲染 Web 应用；单仓库、单部署单元的模块化单体

**Performance Goals**: 10,000 条记录下查询/筛选/排序/统计和写操作反馈 p95 ≤1s；LCP p75 ≤2.5s、INP p75 ≤200ms、CLS ≤0.1

**Constraints**: 公开注册仅创建普通用户；管理员必须受控授予；所有业务数据具备 owner；数据库高权限密钥仅服务端可见；导入每批最多 10,000 行/5MB；中文界面；自然日按 `Asia/Shanghai` 解释

**Scale/Scope**: 多用户、每用户最多 10,000 条投递记录；认证页、普通业务区和管理后台；新增 identity-access 模块；无组织协作、社交登录或外部通知

## Constitution Check

*GATE: Phase 0 前通过；Phase 1 设计后复核通过。*

| Gate | 设计响应 | 结果 |
|------|----------|------|
| 可维护代码与最小复杂度 | 使用 Better Auth 与自有 PostgreSQL，保持单一 identity-access 模块；无自研密码存储、微服务或消息总线 | PASS |
| 测试作为发布门禁 | 认证状态、角色矩阵、RLS/owner 隔离、接口契约及关键旅程覆盖单元、集成与 E2E；变更代码覆盖率 ≥80% | PASS |
| 一致且无障碍的体验 | 共享 UI 原语、统一状态词典和反馈状态；键盘、焦点、语义与 axe/WCAG 2.2 AA 验证进入门禁 | PASS |
| 可量化性能预算 | 采用服务端分页、索引、聚合查询和导入上限；快速启动包含 10k 数据性能验证与 Core Web Vitals | PASS |
| 文档、诊断和秘密管理 | 契约、模型和运行指南版本化；结构化服务端日志不记录简历备注/密钥；仅 `.env.example` 入库 | PASS |
| 回滚与风险控制 | owner 列先可空回填再设非空；迁移必须指定旧数据 owner；Auth 发布可回滚应用但不得删除身份/owner 数据 | PASS |

**Post-design review**: 数据约束、原子更新、接口错误、分页上限、无障碍状态和性能验证已在 Phase 1 产物中具体化，无宪章例外。

## Architecture and Module Boundaries

模块化单体遵守以下依赖方向：`app`（传输与页面）→ `modules/*/application` → `modules/*/domain`；基础设施适配器实现应用层端口。模块不得导入其他模块的内部目录，只能调用其 `index.ts` 导出的应用服务或共享只读 DTO。

- **applications**: 投递聚合、状态/阶段规则、历史事件、列表查询与跟进判定。
- **analytics**: 只读统计用例；依赖 applications 暴露的查询契约，不修改投递。
- **data-transfer**: 导入预检/确认、重复候选处理与导出；通过 applications 批量命令创建记录。
- **identity-access**: 注册、登录、退出、会话、用户资料、角色授权和管理员用户管理；向其他模块暴露 `requireUser`、`requireAdmin` 与 owner 上下文。
- **shared**: 通用错误、日期/分页值对象、数据库客户端、日志和 UI 原语；不得包含投递业务规则。

Next.js Server Components 负责首屏只读查询，同源 JSON Route Handlers 负责当前投递、阶段、统计、认证和面经变更，并提供导入导出接口。入口统一调用应用服务和 Zod 输入契约。数据库写入涉及投递与事件时必须在一个 PostgreSQL 事务/函数中原子完成；首页写入成功后局部更新，列表与统计在后台对账。

## Project Structure

### Documentation (this feature)

```text
specs/001-resume-application-tracking/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── openapi.yaml
└── tasks.md                  # 由 /speckit.tasks 后续生成
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── (auth)/login/page.tsx
│   ├── (auth)/register/page.tsx
│   ├── auth/confirm/route.ts
│   ├── admin/page.tsx
│   ├── (dashboard)/
│   │   ├── page.tsx
│   │   ├── applications/
│   │   │   ├── new/page.tsx
│   │   │   └── [id]/page.tsx
│   │   └── import/page.tsx
│   ├── api/
│   │   ├── applications/route.ts
│   │   ├── applications/[id]/route.ts
│   │   ├── analytics/summary/route.ts
│   │   ├── imports/preview/route.ts
│   │   ├── imports/[id]/confirm/route.ts
│   │   └── exports/applications/route.ts
│   ├── layout.tsx
│   ├── loading.tsx
│   └── error.tsx
├── modules/
│   ├── identity-access/
│   │   ├── application/
│   │   ├── infrastructure/
│   │   ├── ui/
│   │   └── index.ts
│   ├── applications/
│   │   ├── domain/
│   │   ├── application/
│   │   ├── infrastructure/
│   │   ├── ui/
│   │   └── index.ts
│   ├── analytics/
│   │   ├── application/
│   │   ├── infrastructure/
│   │   ├── ui/
│   │   └── index.ts
│   └── data-transfer/
│       ├── application/
│       ├── infrastructure/
│       ├── ui/
│       └── index.ts
├── shared/
│   ├── database/
│   ├── validation/
│   ├── observability/
│   └── ui/
└── generated/
    └── database.types.ts

src/proxy.ts                    # 仅做轻量会话刷新与乐观页面分流

supabase/
├── config.toml
├── migrations/
├── seed.sql
└── tests/

tests/
├── contract/
├── integration/
├── e2e/
├── fixtures/
└── performance/
```

**Structure Decision**: 使用一个 Next.js 应用和一个 PostgreSQL schema 的模块化单体。目录按业务能力而非 MVC 技术层横向切分；`app/` 只负责 Web 传输与组合，业务规则留在模块中。数据库迁移是 schema 的唯一事实来源，生成类型不得手工编辑。

## Data and Transaction Strategy

- 投递状态和阶段使用受数据库约束的稳定英文代码，中文仅为展示标签，避免本地化文案成为数据契约。
- 列表 API 采用游标/页码兼容分页（API 默认 50、首页默认 10、最大 100）和白名单排序；搜索对公司/岗位拼接表达式使用 `pg_trgm` GIN 索引，状态、类型和最新日期使用组合/普通索引。
- `create_application`、`update_application` 与 `add_stage_occurrence` 通过事务性数据库函数维护应用记录、阶段和事件的一致性；服务端应用层仍执行同一份输入/领域校验。
- `latest_date` 是业务日期；`updated_at` 是系统时间。跟进天数基于 `latest_date` 和用户时区的当前日期推导，不存储易失的布尔值。
- 导入预检把归一化行和错误保存到有过期时间的批次中；确认时逐行调用批量数据库函数，保存逐行结果。定期清理过期批次可在请求路径中惰性执行，首期不引入任务队列。
- `users` 与所有业务聚合根保存 `owner_id -> users.id`；子表通过父聚合归属授权。旧数据必须显式选择已注册用户后回填。
- 用户请求使用 Better Auth 数据库 Session 和安全 Cookie 验证身份；普通用户查询强制显式绑定 `owner_id`，管理员后台用例在 `requireAdmin()` 后执行。
- 应用服务和 DAL 必须显式传递 actor 与 owner 条件；共享数据库账号不构成跳过应用层授权的理由。

## Interface and UX Strategy

- `/login`、`/register`、`/forgot-password` 为公开页；普通用户成功登录导航 `/`，管理员导航 `/admin`。`src/proxy.ts` 仅做 Cookie 刷新和乐观重定向，不承担最终授权。
- 认证表单使用同源 Route Handler 与 Zod；错误提示不区分“账号不存在”和“密码错误”，支持密码管理器、键盘和可感知的提交状态。
- 管理后台使用独立导航语义，用户表格展示角色/状态/注册及最近登录时间；高风险操作具名确认并防止锁死最后一个管理员。
- URL 查询参数是列表搜索、筛选、排序、分组和分页的可分享状态；服务端校验未知值并回退默认值。
- 表单使用共享字段、状态徽标、阶段标签、日期格式和错误摘要。服务端错误映射到字段并保留用户输入。
- 删除使用具名确认对话框；焦点进入对话框、取消后返回触发器、确认成功后导航回保留筛选条件的列表。
- 导入是“上传并预检 → 修正映射/选择重复策略 → 确认 → 结果摘要”的明确流程；5MB/10k 行上限在选择文件后尽早提示。
- 统计卡和阶段分布必须有文本数值，不以颜色或图形作为唯一信息载体。

## Testing and Quality Strategy

- **Unit**: 状态分类、日期关系、跟进天数、阶段去重、导入归一化、重复判定、筛选解析。
- **Auth unit/component**: 注册/登录 schema、返回地址白名单、角色分流、统一凭据错误、表单焦点和可访问反馈。
- **Database/integration**: CHECK/FK/索引、事务回滚、事件完整性、统计准确性、分页稳定性、部分成功导入；数据库测试使用临时 PostgreSQL 并销毁。
- **Authorization integration**: Better Auth 用户/Session、owner 回填、显式 owner 谓词、普通用户跨 owner 拒绝、管理员操作、自我锁死保护、禁用后会话拒绝。
- **Contract**: 根据 `contracts/openapi.yaml` 验证请求/响应和标准错误包络；生成数据库类型漂移检查。
- **Component/accessibility**: 表单错误、空/加载/失败状态、对话框焦点、表格键盘操作、颜色对比和 axe 扫描。
- **E2E**: 注册确认、普通/管理员登录分流、退出、密码恢复、越权访问和双用户数据隔离；原四个业务故事继续回归。
- **Performance**: 固定种子生成 10,000 条记录，测量列表、组合筛选、统计和写入 p95；浏览器运行 Core Web Vitals/Lighthouse 门禁。
- CI 顺序为格式检查 → lint → `tsc --noEmit` → 单元/组件覆盖率 → 数据库/契约集成 → E2E/可访问性 → 性能烟测。

## Observability and Operations

- 每个服务端请求生成关联 ID，记录操作名、耗时、结果、错误代码、actor ID（不可逆散列或 UUID）和记录数；不记录密码、令牌、Cookie、备注全文、文件内容或数据库密钥。
- 认证失败与限流事件使用统一代码计数；对外响应不暴露账号存在性，管理员角色变更/禁用操作写入审计事件。
- 标准错误代码区分 validation、not_found、conflict、payload_too_large、unsupported_format、storage 和 internal；UI 提供可执行恢复建议。
- 健康检查只验证应用进程和最小数据库查询，不泄露配置。
- 数据库变更先在本地 `db reset` 验证，再在临时环境应用；破坏性列变更拆为扩展、迁移、收缩步骤。导出是首期用户数据恢复路径。

## Complexity Tracking

无宪章违规，不需要复杂度例外。
