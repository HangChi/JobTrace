# Research: 面试面经记录与复盘

## Decision 1: 采用独立 interviews 业务模块

- **Decision**: 在 `src/modules/interviews` 建立面经领域、应用服务、PostgreSQL 仓储和 UI；投递模块只通过公开 DTO 暴露阶段关联摘要。
- **Rationale**: 面经拥有独立生命周期、列表筛选、问题和行动项，继续堆在 `applications` 会扩大投递聚合的复杂度；独立模块仍能复用认证、日期、错误和 UI 原语。
- **Alternatives considered**: 将面经直接作为 `applications.notes` 的结构化 JSON；被拒绝，因为无法支持问题级排序、查询、乐观并发和阶段一对一约束。

## Decision 2: 阶段关联使用 occurrence ID，并保留快照

- **Decision**: 面经关联 `application_stage_occurrences.id`；同时保存 `stage_snapshot` 与 `interviewed_on`。阶段删除时解除关联但保留面经。
- **Rationale**: 同一阶段类型可以在不同日期重复发生，阶段代码不足以识别一次具体面试；快照可在 `ON DELETE SET NULL` 后保留可读历史。
- **Alternatives considered**: 仅保存阶段代码和日期；被拒绝，因为无法稳定指向一次阶段发生记录，也无法处理后续同类阶段。

## Decision 3: 面经聚合写入使用服务端 Route Handler + PostgreSQL 原子函数

- **Decision**: 页面使用 Next.js App Router Server Components 首屏读取，交互使用 Client Components 调用 `/api/interviews`；仓储通过数据库函数原子维护面经、问题、行动项和阶段关联。
- **Rationale**: 现有应用已经采用相同的 `app → application → repository → PostgreSQL function` 路径，且 Route Handlers 使用原生 Request/Response、不默认缓存，适合认证后的动态数据。
- **Alternatives considered**: 仅使用 Server Actions；被拒绝，因为项目已有稳定 JSON 契约和 Playwright contract 测试，面经也需要保持同源接口可验证。

## Decision 4: 创建未记录阶段时一次事务完成阶段与面经

- **Decision**: `POST /api/interviews` 支持传入已有 `stageOccurrenceId`，或传入 `stage` + `interviewedOn` 创建新阶段并创建面经；后者必须在同一个事务中完成。
- **Rationale**: 从面经入口开始时不应要求用户先离开流程补录阶段；原子操作避免出现孤立阶段或孤立面经。
- **Alternatives considered**: 让浏览器先调用阶段接口、再调用面经接口；被拒绝，因为中途失败会留下不完整数据，且无法可靠处理重复提交。

## Decision 5: 使用整体聚合 PATCH 配合防抖自动保存

- **Decision**: 面经编辑器在字段变更后约 800ms 防抖提交整个聚合，失焦或离开页面前主动 flush；请求携带 `version`，冲突时停止自动保存并提供刷新/重试。
- **Rationale**: 问题、整体反思和行动项需要一致保存；整体 PATCH 比多个子资源请求更容易保证排序和删除的一致性。防抖限制长文本编辑产生的写入量。
- **Alternatives considered**: 每个字段单独接口；被拒绝，因为请求数量大、并发冲突更难处理，且不能保证一次复盘的内部一致性。

## Decision 6: 本轮结果与投递状态完全分离

- **Decision**: 面经保存 `pending`、`passed`、`failed` 本轮结果；不触发投递 `submitted`、`offer`、`refused` 状态变化。下一招聘阶段由用户显式添加。
- **Rationale**: 面试轮次结果可能只是口头反馈或等待确认，自动改变投递终态会造成不可逆的错误状态。
- **Alternatives considered**: 面经通过自动推进阶段、未通过自动拒绝投递；被拒绝，因为会覆盖用户对求职状态的判断。

## Decision 7: v1 保持私密、文本优先和可搜索

- **Decision**: 首期支持文本、日期、分类、评分、结果和行动项；所有数据按现有 owner 隔离；不加入公开分享、附件、音视频、AI 生成或外部同步。
- **Rationale**: 面经包含敏感的自我评价，先把记录和复盘闭环做可靠；文本字段可直接参与搜索并保持实现和运维成本可控。
- **Alternatives considered**: 同期加入社区分享或 AI 总结；被拒绝，因为会扩大权限、隐私和内容安全范围，不能服务 P1 核心流程。

## Decision 8: 遵循 Next.js 16 App Router 约定

- **Decision**: 页面和布局保持 Server Component 默认行为；需要状态、事件和浏览器 API 的编辑器、筛选器和删除对话框使用最小 Client Component 边界；动态路由参数按 Promise 读取；Route Handler 使用 `route.ts` 和原生 `Request`/`Response`。
- **Rationale**: 与仓库当前 Next.js 16.3.0 代码和官方文档一致，减少客户端 JavaScript，保持动态数据库查询不被错误缓存。
- **Alternatives considered**: 将整个面经页面标记为 Client Component；被拒绝，因为会扩大 bundle 并绕过 Server Component 的服务端数据读取优势。
