# Implementation Plan: 管理员后台增强

**Branch**: `004-enhance-admin-console` | **Date**: 2026-08-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-enhance-admin-console/spec.md`

## Summary

在既有管理员角色分流、用户分页、角色/启停和全局数量摘要之上，补齐可运营的后台首页、可恢复的用户检索与详情、安全且幂等的账号访问变更、即时会话撤销和只读审计查询。实现继续位于 Next.js 模块化单体的 `identity-access` 模块；页面以请求时 Server Component 读取为主，筛选状态写入 URL，同源 Route Handlers 承载可验证的 JSON 边界，PostgreSQL 原子函数负责并发、最后管理员保护、状态变化与审计一致性。

## Technical Context

**Language/Version**: TypeScript 5.9（strict）；Node.js 24 LTS；SQL/PLpgSQL（PostgreSQL）

**Primary Dependencies**: Next.js 16.x App Router、React 19.x、Better Auth 1.6.x、`postgres`/`pg`、Zod 4.x、React Hook Form、date-fns

**Storage**: 现有自有 PostgreSQL；扩展 `users` 访问版本与 `admin_audit_events` 审计字段/索引，不新增独立存储服务

**Testing**: Vitest + Testing Library（规则与组件）、临时 PostgreSQL + pgTAP/集成测试（约束与事务）、Playwright（HTTP 契约、E2E、可访问性、性能）、Lighthouse CI（Web Vitals）

**Target Platform**: Node.js Web 运行时；Chrome、Edge、Firefox当前及前一主要版本；375px、768px 和 ≥1280px 代表性视口

**Project Type**: 服务端渲染 Web 应用；单仓库、单部署单元的模块化单体

**Performance Goals**: 10,000 用户与 100,000 审计事件下，用户检索/筛选/详情和审计查询 p95 ≤2s；账号变更反馈 p95 ≤1s；LCP p75 ≤2.5s、INP p75 ≤200ms、CLS ≤0.1

**Constraints**: 仅有效管理员可访问；普通业务路径继续按 owner 隔离；目录保持最小数据，指定用户档案可分页只读投递与面经正文但不得编辑/删除/导出；禁用必须原子撤销全部会话；最后有效管理员不可禁用/降级；所有日期按 `Asia/Shanghai`；日志与审计不得包含凭据、会话或个人求职正文

**Scale/Scope**: 至少 10,000 用户、100,000 审计事件；4 个后台页面和 5 个管理员 HTTP 操作；不含删除用户、批量变更、自定义角色、密码重置、通知和审计导出

## Constitution Check

*GATE: Phase 0 前通过；Phase 1 设计后复核通过。*

| Gate | 设计响应 | 结果 |
|------|----------|------|
| 可维护代码与最小复杂度 | 扩展现有 `identity-access` 模块和数据库事务函数；不增加微服务、消息队列或新依赖；页面、应用服务、仓储职责保持单一 | PASS |
| 测试作为发布门禁 | 规则、查询解析、数据库约束/并发、HTTP 契约、组件、E2E、越权、可访问性和性能均有对应测试层；变更行/分支覆盖率维持 ≥80% | PASS |
| 一致且无障碍的体验 | 复用共享按钮、对话框、反馈和焦点模式；明确加载/空/成功/失败状态；键盘、窄屏与 WCAG 2.2 AA 纳入验收 | PASS |
| 可量化性能预算 | 服务端分页、稳定排序、专用组合索引和代表性 10k/100k 数据基准覆盖规格预算与 Core Web Vitals | PASS |
| 文档、诊断和秘密管理 | 数据模型、OpenAPI 和运行指南版本化；日志仅记录 request ID、操作者/目标 ID、结果码和耗时，不记录原因正文、Cookie 或个人内容 | PASS |
| 回滚与风险控制 | 采用可向后兼容的扩展式迁移；旧接口在应用切换期间可继续读取新增默认列；应用可回滚但审计和访问版本列不得回退删除 | PASS |

**Post-design review**: Phase 1 已将最小 DTO、乐观并发、幂等重放、审计不可变性、会话撤销、索引、错误映射、测试层次和回滚路径写入数据模型、契约与快速验证指南。没有未解决澄清项或宪法例外。

## Architecture and Module Boundaries

继续采用 `app → identity-access/application → identity-access/infrastructure → PostgreSQL` 的依赖方向。`app` 只负责路由参数、HTTP/页面传输和 UI 组合；应用层定义查询、命令、DTO 与错误映射；基础设施层执行参数化查询和原子数据库函数。其他业务模块不向管理员页面暴露内部仓储，管理员统计仅通过受控的只读聚合查询计数。

- **页面边界**: `/admin` 展示运营摘要；`/admin/users` 承载用户检索；`/admin/users/[id]` 展示账号档案、分页只读求职内容并发起访问变更；`/admin/audit` 查询审计。新增 `/admin/layout.tsx` 提供一致的管理员导航和区域语义。
- **读取路径**: 页面保持 Server Component，`searchParams`/动态 `params` 按 Next.js 16 Promise 约定读取。服务端解析 URL 条件后直接调用应用查询；后台数据依赖请求会话且保持请求时动态，不使用跨管理员共享缓存。
- **交互边界**: 搜索、筛选和分页以 URL 为事实来源；客户端只负责渐进式提交、确认对话框、pending/反馈和刷新。账号变更调用同源 Route Handler，并在每个入口重新执行管理员授权和来源校验。
- **数据最小化**: 用户目录只返回账号元数据和计数；详情按独立页码返回最多 10 条投递和 10 条面经，只包含运营核查所需业务字段。简历、附件、Session token、IP 与 user-agent 不进入管理员 DTO，正文不进入日志。
- **安全纵深**: 页面保护用于用户体验；`requireAdmin()`、应用服务与原子数据库函数分别验证当前有效管理员。Proxy 不承担最终授权，客户端隐藏按钮也不构成安全控制。

## Data and Transaction Strategy

- 为 `users` 增加 `access_version`，仅在角色或禁用状态成功变化时递增；客户端提交 `expectedVersion`，旧版本请求得到冲突且不覆盖新状态。
- 将每个访问变更限制为一个具名动作：提升管理员、降级普通用户、禁用、启用。请求携带 UUID `requestId`、非空原因、预期版本；自我降级/禁用额外要求强化确认标志。
- 数据库原子函数锁定目标用户，并在必要时锁定/核对有效管理员集合；同一事务内完成最后管理员保护、状态更新、版本递增、Session 删除和成功审计。
- 已认证且通过结构校验的业务拒绝（版本冲突、最后管理员保护、自我确认缺失）以确定性结果返回并写入拒绝/冲突审计；这些结果不通过抛出后回滚审计。意外基础设施失败写结构化服务日志，管理员使用相同 `requestId` 重试。
- `requestId` 在审计表唯一；相同请求载荷重试返回原结果，不重复更新或重复审计；相同 ID 搭配不同载荷返回幂等冲突。
- 审计保存事件发生时的操作者与目标账号快照，并将用户外键调整为可空 `ON DELETE SET NULL`；历史仍可辨认，更新/删除触发器继续禁止审计篡改。
- 用户目录按 `created_at desc, id desc` 稳定分页并返回总数；搜索对规范化用户名/邮箱使用 trigram 索引，角色/状态/注册时间使用组合索引。审计按 `created_at desc, id desc` 稳定分页，操作者、目标、类型、结果和时间范围均有受控索引路径。
- 运营摘要直接从现有用户、Session、投递和面经数据计算；“活跃”是窗口内至少创建一次有效登录 Session 的未禁用用户。30 天趋势按 `Asia/Shanghai` 自然日聚合，不引入定时任务或物化副本。

## Interface and UX Strategy

- `/admin` 使用独立卡片区分账号总量、有效/禁用/管理员、投递/面经总量与 7/30 天活跃；卡片分别表达可用、无数据和加载失败，显示口径、时区和生成时间。
- `/admin/users` 提供用户名/内部邮箱关键词、角色、状态、注册日期和页码；表格在宽屏展示，在窄屏转换为带字段标签的卡片列表，避免关键信息截断。
- `/admin/users/[id]` 以账号档案布局展示账号资料、数量、分页投递/面经只读折叠区和最近管理事件；高风险操作置于独立侧栏并使用共享对话框，自我操作增加第二层明确确认。
- 成功后局部刷新服务端数据并发布辅助技术可读状态；验证失败保留原因；冲突展示最新状态并要求重新确认；结果未知保留 `requestId` 供安全重试。
- `/admin/audit` 提供只读表格/卡片与组合筛选，不渲染编辑、删除或导出入口。账号已删除时展示事件快照和“账号已删除”标签。

## HTTP and Error Strategy

- 延续原生 `Request`/`Response` Route Handlers 与 Problem JSON 包络；管理员读取接口不缓存，所有请求在服务端重新验证数据库 Session 和角色。
- `GET /api/admin/summary` 返回带数据状态、时区和生成时间的摘要；`GET /api/admin/users` 与 `GET /api/admin/audit-events` 返回带总数的页码分页；`GET /api/admin/users/{id}` 返回账号详情及由 `applicationsPage`、`interviewsPage` 控制的只读求职内容分页。
- `PATCH /api/admin/users/{id}` 接收具名动作、原因、`requestId`、`expectedVersion` 和可选自我确认；返回更新后 DTO、审计引用与是否幂等重放。
- 输入错误为 `400`，未登录为 `401`，非管理员/禁用账号为 `403`，目标不存在为 `404`，版本、最后管理员、自我确认和幂等载荷冲突为 `409`。错误响应不泄露个人求职内容或会话信息。

## Testing, Observability, and Release Strategy

- **Unit**: URL 查询规范化、日期范围、动作输入、原因长度、自我确认判定、DTO 数据最小化和稳定分页规则。
- **Database/integration**: 新列/约束/索引、并发版本冲突、最后管理员并发保护、Session 原子撤销、幂等重放/载荷冲突、成功/拒绝审计和审计不可变性。
- **Contract**: 按 [contracts/openapi.yaml](./contracts/openapi.yaml) 验证摘要、用户列表/详情/变更和审计列表的 200/400/401/403/404/409 响应与 Problem 包络。
- **Component/accessibility**: 筛选恢复、空/错误状态、响应式用户/审计列表、原因验证、强化确认、pending、冲突和焦点返回；键盘与 axe 覆盖。
- **E2E/security**: 管理员主旅程、普通用户/访客/禁用用户拒绝、仅管理员可读取指定 owner 正文、两管理员并发、自我降级/禁用、最后管理员保护和幂等重试。
- **Performance**: 隔离临时数据库生成 10,000 用户、相应业务计数和 100,000 审计事件，预热后测量组合筛选、详情、摘要和变更 p95；复用 Web Vitals 门禁。
- **Observability**: 读取记录操作名、request ID、筛选类别、结果数量和耗时；写入记录 request ID、actor/target ID、action、outcome、error code 和耗时。搜索文本、原因、邮箱、Cookie、Session、IP/user-agent 和求职内容不得进入服务日志。
- **Rollout/rollback**: 先部署扩展式迁移与兼容数据库函数，再部署应用；验证新旧管理读取后切换页面。异常时回滚应用构建，保留 `access_version`、新审计列和事件；禁用管理写入而不是删除审计数据。

## Project Structure

### Documentation (this feature)

```text
specs/004-enhance-admin-console/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── openapi.yaml
└── tasks.md                       # 由 $speckit-tasks 后续生成
```

### Source Code (repository root)

```text
src/app/admin/
├── layout.tsx
├── loading.tsx
├── error.tsx
├── page.tsx
├── users/
│   ├── page.tsx
│   └── [id]/page.tsx
└── audit/page.tsx

src/app/api/admin/
├── summary/route.ts
├── users/route.ts
├── users/[id]/route.ts
└── audit-events/route.ts

src/modules/identity-access/
├── application/
│   ├── admin-query-schema.ts
│   ├── admin-summary-service.ts
│   ├── admin-user-service.ts
│   └── admin-audit-service.ts
├── infrastructure/
│   └── postgres-admin-repository.ts
├── ui/
│   ├── admin-nav.tsx
│   ├── admin-summary.tsx
│   ├── admin-user-filters.tsx
│   ├── user-admin-table.tsx
│   ├── admin-user-detail.tsx
│   ├── admin-access-dialog.tsx
│   ├── admin-audit-filters.tsx
│   └── admin-audit-table.tsx
└── index.ts

supabase/migrations/
└── <timestamp>_admin_console_enhancement.sql

tests/
├── unit/identity-access/
├── component/identity-access/
├── integration/identity-access/
├── contract/admin-console.contract.test.ts
├── e2e/admin-console.spec.ts
├── e2e/admin-console-accessibility.spec.ts
└── performance/admin-console-performance.ts
```

**Structure Decision**: 保持单一 Next.js + PostgreSQL 模块化单体并扩展已有 `identity-access`；不建立第二套后台工程或通用管理框架。页面/Route Handler 只处理传输，管理规则集中于应用服务和数据库原子函数，生成数据库类型仍由迁移生成且不得手工修改。

## Complexity Tracking

无宪法违规，不需要复杂度例外。
