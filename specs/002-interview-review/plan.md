# Implementation Plan: 面试面经记录与复盘

**Branch**: `002-interview-review` | **Date**: 2026-08-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-interview-review/spec.md`

## Summary

新增独立 `interviews` 业务模块，让用户从投递详情的具体招聘阶段创建面经，记录问题与回答、整体反思和行动项，并在面经列表中搜索回顾。面经通过具体阶段 occurrence ID 关联；阶段被删除时解除关联但保留面经快照，投递删除时连带删除面经。实现沿用现有 Next.js App Router、模块化单体、PostgreSQL 原子函数、Route Handler、Zod 和 owner 隔离模式。

## Technical Context

**Language/Version**: TypeScript 5.9 strict；Node.js 24 LTS

**Primary Dependencies**: Next.js 16.3 App Router、React 19、Better Auth、`postgres`/`pg`、Zod 4、React Hook Form、Vitest、Testing Library、Playwright、axe

**Storage**: 现有 PostgreSQL schema；新增面经、问题、行动项表及原子数据库函数，生成类型更新到 `src/generated/database.types.ts`

**Testing**: Vitest 单元/组件、PostgreSQL 集成与 schema 测试、Playwright HTTP 契约/E2E、axe 可访问性、固定 10,000 条面经性能数据

**Target Platform**: Next.js 服务端渲染 Web 应用；Chrome/Edge/Firefox 当前及前一主要版本；桌面与较窄视口均可完成核心流程

**Project Type**: 模块化单体 Web 应用

**Performance Goals**: 面经搜索/组合筛选 p95 ≤1 秒；创建、聚合更新、删除和行动项勾选反馈 p95 ≤1 秒；LCP p75 ≤2.5 秒、INP p75 ≤200ms、CLS ≤0.1

**Constraints**: 所有读写要求登录并校验 owner；每个阶段 occurrence 最多一篇面经；阶段与面经的首次关联写入必须原子；长文本自动保存使用防抖和 version 冲突保护；首期仅私密文本复盘，不包含附件、AI、分享或外部同步

**Scale/Scope**: 每用户最多 10,000 篇面经；每篇最多 200 个问题和 100 个行动项；新增 `/interviews`、`/interviews/new`、`/interviews/[id]` 及面经 API，同时扩展投递详情的阶段面经摘要

## Constitution Check

*GATE: Phase 0 前通过；Phase 1 设计后复核通过。*

| Gate | 设计响应 | 结果 |
|------|----------|------|
| 可维护代码与最小复杂度 | 新增单一 `interviews` 模块；问题和行动项属于面经聚合，避免跨模块重复规则；复用现有错误、日期、分页和 UI 原语 | PASS |
| 测试作为发布门禁 | 为领域校验、数据库约束/事务、接口契约、编辑器状态、owner 隔离和主流程分别安排 unit/integration/contract/E2E；覆盖率保持 ≥80% | PASS |
| 一致且无障碍的体验 | 复用现有导航、表单、徽标、确认对话框和反馈模式；动态保存、错误、空状态、键盘焦点和窄视口均纳入测试 | PASS |
| 可量化性能预算 | 列表游标分页、owner/状态/阶段索引、问题搜索约束和 10k 固定数据性能烟测；遵守 p95 与 Core Web Vitals 门槛 | PASS |
| 文档、诊断和秘密管理 | 规格、模型、契约和 quickstart 版本化；日志仅记录 request ID/操作/耗时/错误代码，不记录面经全文或敏感字段 | PASS |
| 回滚与风险控制 | 先扩展表/枚举/函数，再接入应用；阶段 FK 使用 SET NULL 保护面经；迁移可重放，应用保留旧投递读取路径 | PASS |

**Post-design review**: Phase 1 已确定聚合字段、状态、原子边界、owner 关系、接口错误、分页、自动保存冲突和删除语义；未发现宪章例外。

## Architecture and Module Boundaries

依赖方向保持 `app → modules/interviews/application → domain`，基础设施实现仓储端口，UI 只调用公开应用服务或同源 Route Handler。

- **interviews/domain**: 枚举、输入 schema、状态完成规则、阶段关联校验、问题/行动项排序规则。
- **interviews/application**: 创建/查询/更新/删除、列表查询、聚合 version 冲突、owner actor 约束和 DTO。
- **interviews/infrastructure**: PostgreSQL 读写、原子聚合函数、阶段关联查询和分页。
- **interviews/ui**: 面经列表/筛选、编辑器、问题块、整体复盘、行动项、删除确认和空/失败状态。
- **applications**: 提供阶段时间线 CTA 和阶段编辑/删除对面经的提示；不读取 interviews 内部表结构，由页面/Route Handler 组合 `interviews` 公开的投递摘要查询。
- **app**: 新增页面和 `api/interviews` Route Handlers；页面保持 Server Component，动态表单/筛选/对话框使用最小 Client Component。

Next.js 16 约定：动态 `params` 按 Promise 解包；Route Handler 使用 `route.ts` 和原生 `Request`/`Response`；首屏数据库读取不放入 Client Component；GET 面经列表保持请求时动态，不启用静态缓存。

## Data and Transaction Strategy

- 新增 `interview_reviews`、`interview_questions`、`interview_action_items`；面经的 `stage_occurrence_id` 对阶段 occurrence 建唯一可空关联，并保留 `stage_snapshot`/`interviewed_on` 快照。
- `create_interview_review_for_owner` 在已有阶段或新阶段两种输入下分别校验 owner、日期、可面试阶段和重复关联；新阶段模式一次事务写入 occurrence 与 review。
- `update_interview_review_for_owner` 锁定聚合、校验 version，整体替换/重排问题和行动项，计算 draft/pending/completed 状态并递增 version。
- 删除阶段沿用现有阶段删除函数，依赖 FK `ON DELETE SET NULL` 保留面经；删除投递依赖级联删除并由 UI 明确确认。
- 面经列表按 owner 过滤，join applications 读取公司/岗位，按 `interviewed_on desc, id` 稳定游标分页；问题搜索限制在 owner 范围内。
- 面经更新不写入投递审计事件；阶段新增/删除/修改继续维护投递历史，面经详情显示当前阶段关联和快照。
- `stage_changed` 若当前阶段能力需要补齐，新增事件类型和 occurrence 更新函数；不通过“删后重建”破坏面经关联。

## Interface and UX Strategy

- 顶层账号导航新增“投递记录”和“面经”链接；`/interviews` 以最近面试优先展示列表，空状态引导从投递选择阶段。
- 投递详情阶段时间线对 interview_1/interview_2/interview_3/hr_interview/final_interview 显示“记录面经”或已有状态；重复入口直接打开已有面经。
- `/interviews/new` 支持已有阶段选择和“补录阶段后创建”两种路径；基础信息自动带入，创建成功进入编辑详情。
- 面经详情使用 Server Component 加载初始 DTO，客户端编辑器维护问题/行动项排序、保存状态和防抖 PATCH；保存成功显示最近保存时间，冲突停止自动保存并提供刷新/重试。
- 编辑字段分为“面试背景”“问题记录”“整体复盘”“下一步行动”；完成按钮按 FR-011 校验，不以颜色单独表示状态。
- 删除面经、阶段和投递均使用现有确认对话框和焦点返回模式；阶段删除提示解除关联，投递删除提示级联删除。

## Testing and Quality Strategy

- **Unit**: 面试阶段白名单、日期/时长/评分/文本校验、完成条件、状态转换、问题/行动项重排、筛选解析和游标。
- **Database/integration**: 表/枚举/FK/索引、occurrence 唯一关联、已有阶段创建、新阶段+面经原子回滚、version 冲突、阶段 SET NULL、投递级联删除、owner 隔离。
- **Contract**: 根据 [contracts/openapi.yaml](./contracts/openapi.yaml) 验证列表、创建、详情、聚合 PATCH、删除和 Problem 错误包络；跨 owner 资源统一按未找到处理。
- **Component/accessibility**: 编辑器字段错误、问题增删排序、行动项勾选、自动保存/失败/冲突、空状态、确认对话框焦点、键盘操作和 axe。
- **E2E**: 阶段创建面经、不同日期同类阶段、多问题复盘、草稿恢复、完成条件、阶段解除关联、投递级联删除、面经搜索筛选、双用户隔离。
- **Performance**: 固定 10,000 篇面经及问题数据，测量列表/搜索/筛选/聚合更新 p95 与 Core Web Vitals；验证分页无重复/遗漏。

## Project Structure

### Documentation (this feature)

```text
specs/002-interview-review/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── openapi.yaml
└── tasks.md                  # 由 $speckit-tasks 后续生成
```

### Source Code (repository root)

```text
src/app/
├── interviews/
│   ├── page.tsx
│   ├── new/page.tsx
│   └── [id]/page.tsx
├── api/interviews/
│   ├── route.ts
│   └── [id]/route.ts
├── applications/[id]/page.tsx       # 组合面经摘要与阶段入口
└── api/applications/[id]/route.ts    # 保持投递边界，按需组合公开面经摘要

src/modules/interviews/
├── domain/
│   ├── catalog.ts
│   ├── interview.schema.ts
│   └── interview.ts
├── application/
│   ├── contracts.ts
│   ├── interview-service.ts
│   ├── list-query.ts
│   └── ports.ts
├── infrastructure/
│   └── postgres-interview-repository.ts
├── ui/
│   ├── interview-list.tsx
│   ├── interview-filters.tsx
│   ├── interview-editor.tsx
│   ├── interview-question-list.tsx
│   ├── interview-action-items.tsx
│   └── delete-interview-dialog.tsx
└── index.ts

supabase/migrations/
└── <timestamp>_interview_reviews.sql

tests/
├── unit/interviews/
├── component/interviews/
├── integration/interviews/
├── contract/interview-review.contract.test.ts
└── e2e/interview-review.spec.ts
```

**Structure Decision**: 继续使用单一 Next.js + PostgreSQL 模块化单体；新增能力按领域独立，页面和 Route Handler 只负责组合/传输，数据库迁移是 schema 唯一事实来源，生成类型不得手工编辑。

## Complexity Tracking

无宪章违规，不需要复杂度例外。
