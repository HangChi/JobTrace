# Implementation Plan: 个人面经与面经广场

**Branch**: `codex/007-interview-square-sharing` | **Date**: 2026-09-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-interview-square-sharing/spec.md`

## Summary

扩展现有 `interviews` 模块，在同一面经聚合上增加私有/公开、匿名/署名和发布时间状态；所有者接口继续返回完整数据，新增独立的登录可见公开查询与最小 DTO。`/interviews` 改为广场，现有个人列表迁至 `/interviews/mine`，编辑深链保持不变，公开详情使用 `/interviews/shared/[id]`。

## Technical Context

**Language/Version**: TypeScript 5.9 strict；Node.js 24 LTS；PostgreSQL

**Primary Dependencies**: Next.js 16.3 App Router、React 19、Better Auth、`postgres`/`pg`、Zod 4

**Storage**: 现有 PostgreSQL `interview_reviews`、`interview_questions` 和 `users`；新增枚举、列、约束与部分索引

**Testing**: Vitest、Testing Library、临时 PostgreSQL integration/contract、Playwright E2E、axe、现有 Python 性能套件

**Target Platform**: 受保护的响应式 Web 应用；当前与前一主要版本的 Chrome、Edge、Firefox

**Project Type**: Next.js 模块化单体 Web 应用

**Performance Goals**: 广场读取 p95 ≤500ms；发布写入 p95 ≤1s；LCP p75 ≤2.5s、INP p75 ≤200ms、CLS ≤0.1

**Constraints**: 默认私有；公开必须已完成；所有写操作 owner 隔离；匿名响应不得包含作者对象；公开 DTO 不得由完整 DTO 运行时删字段生成；复用版本冲突控制

**Scale/Scope**: 每用户最多 10,000 篇个人面经；代表性场景 1,000 篇公开面经；不新增社交互动或审核系统

## Constitution Check

*GATE: Phase 0 前通过；Phase 1 设计后复核通过。*

| Gate | Design response | Result |
|------|-----------------|--------|
| Maintainable Code | 扩展现有 interviews 聚合，所有者仓储与公开仓储接口显式分离，不复制内容模型 | PASS |
| Testing Release Gate | 领域状态机、数据库约束、DTO 泄漏、接口、UI、E2E 与性能均有测试任务，保持 80% 覆盖率 | PASS |
| Accessible UX | 复用现有表单、菜单、状态徽标和反馈模式；发布控件具有文字标签、焦点与错误反馈 | PASS |
| Performance Budgets | 使用部分索引和发布时间游标；公开列表只选择必要字段并执行固定数据性能验证 | PASS |
| Documentation & Diagnostics | Spec、模型、OpenAPI、quickstart 与任务可追溯；日志不记录面经正文和身份数据 | PASS |
| Rollback | 迁移只添加枚举/列/约束/索引，历史数据默认私有；应用回滚后新增列不影响旧查询 | PASS |

**Post-design review**: 公开状态机、公开 DTO、路由边界和索引已在 Phase 1 固化，无宪章例外。

## Architecture and Data Flow

1. 所有者在编辑器修改正文、复盘状态或分享设置，客户端继续通过 `PATCH /api/interviews/[id]` 自动保存完整 owner update payload。
2. 应用层先按 owner 校验并解析状态；数据库函数在一笔事务内应用版本检查、自动下架规则、署名模式和发布时间转换。
3. 广场页面 Server Component 调用公开查询服务；服务仍要求当前登录用户，但查询不按 viewer owner 过滤，只读取 `visibility='public' AND status='completed'`。
4. 公开仓储直接构造 `PublicInterviewSummary`/`PublicInterviewDetail`，匿名记录不 join/映射作者对象；署名记录只映射用户名和头像。
5. 所有者列表、投递详情、分析和导出继续使用现有 owner 查询，不受分享状态过滤。

## Project Structure

### Documentation

```text
specs/007-interview-square-sharing/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/openapi.yaml
├── checklists/requirements.md
└── tasks.md
```

### Source Code

```text
supabase/migrations/20260913000100_interview_square_sharing.sql
src/modules/interviews/
├── domain/
├── application/
├── infrastructure/
└── ui/
src/app/(protected)/interviews/
├── page.tsx
├── mine/page.tsx
├── shared/[id]/page.tsx
├── new/page.tsx
└── [id]/page.tsx
src/app/api/interviews/public/
├── route.ts
└── [id]/route.ts
tests/{unit,component,integration,contract,e2e}/
```

**Structure Decision**: 沿用当前模块化单体和 `app → application → domain` 依赖方向；广场页面保持 Server Component，公司搜索使用原生 GET 表单，只有编辑交互使用现有 Client Component。

## Migration and Rollback

- 新增 `interview_visibility` 与 `interview_author_mode` 枚举，以及 `visibility NOT NULL DEFAULT 'private'`、`author_mode NOT NULL DEFAULT 'anonymous'`、`published_at timestamptz`。
- 增加检查约束：公开记录必须已完成且具有发布时间；私有记录不得具有发布时间。
- 替换 owner 更新函数：非 completed 状态强制 private/anonymous/null published timestamp；首次或重新发布设置 `published_at=now()`；公开模式间切换保留当前发布时间。
- 增加 `(published_at DESC, id DESC) WHERE visibility='public' AND status='completed'` 部分索引，并补充公开搜索所需索引。
- 回滚应用时可保留新增列；紧急缓解可批量将 visibility 设为 private，使广场立即为空。
