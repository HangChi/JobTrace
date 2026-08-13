# Implementation Plan: 职迹简历投递管理

**Branch**: `001-resume-application-tracking` | **Date**: 2026-08-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-resume-application-tracking/spec.md`

## Summary

构建一个面向个人用户的桌面 Web 应用，以投递记录为聚合根，覆盖记录维护、状态与阶段历史、列表检索、统计和跟进提醒、CSV/XLSX 导入导出。采用 Next.js App Router + TypeScript 的模块化单体：页面、服务端入口和领域模块在同一部署单元内，模块只能通过公开应用服务交互。Supabase 提供托管 PostgreSQL、本地开发栈、迁移和数据库类型生成；浏览器不得直接持有高权限数据库凭据或直接访问业务表。

## Technical Context

**Language/Version**: TypeScript 5.x（strict）；Node.js 24 LTS

**Primary Dependencies**: Next.js 16.x App Router、React 19.x、`@supabase/supabase-js`、Zod、React Hook Form、TanStack Table、SheetJS、date-fns

**Storage**: Supabase 托管 PostgreSQL；SQL 迁移纳入版本控制；CSV/XLSX 文件仅在导入请求期间处理，不长期保存原文件

**Testing**: Vitest + Testing Library（单元/组件）、Supabase 本地栈 + pgTAP/Vitest（数据库与集成）、Playwright + axe（端到端与可访问性）

**Target Platform**: Node.js Web 运行时；Chrome、Edge、Firefox 当前及前一主要版本；桌面视口 ≥1280px，核心流程兼容较窄桌面窗口

**Project Type**: 服务端渲染 Web 应用；单仓库、单部署单元的模块化单体

**Performance Goals**: 10,000 条记录下查询/筛选/排序/统计和写操作反馈 p95 ≤1s；LCP p75 ≤2.5s、INP p75 ≤200ms、CLS ≤0.1

**Constraints**: 首期无账号；数据库密钥仅服务端可见；导入每批最多 10,000 行/5MB；中文界面；自然日按 `Asia/Shanghai` 解释，存储业务日期为 `date`

**Scale/Scope**: 单用户、最多 10,000 条投递记录；约 5 个主页面/流程；4 个领域模块；无实时协作、后台任务或外部通知

## Constitution Check

*GATE: Phase 0 前通过；Phase 1 设计后复核通过。*

| Gate | 设计响应 | 结果 |
|------|----------|------|
| 可维护代码与最小复杂度 | 单部署单元、按业务能力分模块；无微服务、消息总线或通用仓储层；公开模块入口明确 | PASS |
| 测试作为发布门禁 | 领域规则、数据库约束、接口契约和四条关键旅程分别定义单元、集成、契约与 E2E 测试；变更代码覆盖率 ≥80% | PASS |
| 一致且无障碍的体验 | 共享 UI 原语、统一状态词典和反馈状态；键盘、焦点、语义与 axe/WCAG 2.2 AA 验证进入门禁 | PASS |
| 可量化性能预算 | 采用服务端分页、索引、聚合查询和导入上限；快速启动包含 10k 数据性能验证与 Core Web Vitals | PASS |
| 文档、诊断和秘密管理 | 契约、模型和运行指南版本化；结构化服务端日志不记录简历备注/密钥；仅 `.env.example` 入库 | PASS |
| 回滚与风险控制 | 数据库迁移先扩展后收缩；发布保留上一构建；导入先预检后确认，不静默覆盖 | PASS |

**Post-design review**: 数据约束、原子更新、接口错误、分页上限、无障碍状态和性能验证已在 Phase 1 产物中具体化，无宪章例外。

## Architecture and Module Boundaries

模块化单体遵守以下依赖方向：`app`（传输与页面）→ `modules/*/application` → `modules/*/domain`；基础设施适配器实现应用层端口。模块不得导入其他模块的内部目录，只能调用其 `index.ts` 导出的应用服务或共享只读 DTO。

- **applications**: 投递聚合、状态/阶段规则、历史事件、列表查询与跟进判定。
- **analytics**: 只读统计用例；依赖 applications 暴露的查询契约，不修改投递。
- **data-transfer**: 导入预检/确认、重复候选处理与导出；通过 applications 批量命令创建记录。
- **shared**: 通用错误、日期/分页值对象、数据库客户端、日志和 UI 原语；不得包含投递业务规则。

Next.js Server Components 负责首屏只读查询，Server Actions 负责同源表单变更，Route Handlers 提供导入、导出及稳定的 JSON 接口。无论入口类型，均调用同一应用服务和 Zod 输入契约。数据库写入涉及投递与事件时必须在一个 PostgreSQL 事务/函数中原子完成。

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
- 列表采用游标分页（默认 50、最大 100）和白名单排序；搜索对标准化公司/岗位字段使用 `pg_trgm` GIN 索引，状态、城市、日期和最新日期使用组合/普通索引。
- `create_application`、`update_application` 与 `add_stage_occurrence` 通过事务性数据库函数维护应用记录、阶段和事件的一致性；服务端应用层仍执行同一份输入/领域校验。
- `latest_date` 是业务日期；`updated_at` 是系统时间。跟进天数基于 `latest_date` 和用户时区的当前日期推导，不存储易失的布尔值。
- 导入预检把归一化行和错误保存到有过期时间的批次中；确认时逐行调用批量数据库函数，保存逐行结果。定期清理过期批次可在请求路径中惰性执行，首期不引入任务队列。
- 业务表关闭 `anon`/`authenticated` 直接权限；Next.js 服务端使用仅服务端环境变量访问。首期部署必须是个人私有环境，账号体系引入前不得作为公开多用户服务发布。

## Interface and UX Strategy

- URL 查询参数是列表搜索、筛选、排序、分组和分页的可分享状态；服务端校验未知值并回退默认值。
- 表单使用共享字段、状态徽标、阶段标签、日期格式和错误摘要。服务端错误映射到字段并保留用户输入。
- 删除使用具名确认对话框；焦点进入对话框、取消后返回触发器、确认成功后导航回保留筛选条件的列表。
- 导入是“上传并预检 → 修正映射/选择重复策略 → 确认 → 结果摘要”的明确流程；5MB/10k 行上限在选择文件后尽早提示。
- 统计卡和阶段分布必须有文本数值，不以颜色或图形作为唯一信息载体。

## Testing and Quality Strategy

- **Unit**: 状态分类、日期关系、跟进天数、阶段去重、导入归一化、重复判定、筛选解析。
- **Database/integration**: CHECK/FK/索引、事务回滚、事件完整性、统计准确性、分页稳定性、部分成功导入；每次测试重置本地 Supabase。
- **Contract**: 根据 `contracts/openapi.yaml` 验证请求/响应和标准错误包络；生成数据库类型漂移检查。
- **Component/accessibility**: 表单错误、空/加载/失败状态、对话框焦点、表格键盘操作、颜色对比和 axe 扫描。
- **E2E**: 四个优先用户故事各至少一条关键旅程；删除取消、无结果和混合导入作为回归场景。
- **Performance**: 固定种子生成 10,000 条记录，测量列表、组合筛选、统计和写入 p95；浏览器运行 Core Web Vitals/Lighthouse 门禁。
- CI 顺序为格式检查 → lint → `tsc --noEmit` → 单元/组件覆盖率 → 数据库/契约集成 → E2E/可访问性 → 性能烟测。

## Observability and Operations

- 每个服务端请求生成关联 ID，记录操作名、耗时、结果、错误代码和记录数；不记录备注全文、职位链接查询参数、文件内容或数据库密钥。
- 标准错误代码区分 validation、not_found、conflict、payload_too_large、unsupported_format、storage 和 internal；UI 提供可执行恢复建议。
- 健康检查只验证应用进程和最小数据库查询，不泄露配置。
- 数据库变更先在本地 `db reset` 验证，再在临时环境应用；破坏性列变更拆为扩展、迁移、收缩步骤。导出是首期用户数据恢复路径。

## Complexity Tracking

无宪章违规，不需要复杂度例外。
