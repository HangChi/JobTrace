# Phase 0 Research: 职迹技术决策

## 1. Next.js 应用边界

**Decision**: 使用 Next.js 16.x App Router。只读首屏采用 Server Components；同源表单变更采用 Server Actions；需要文件上传/下载或稳定 HTTP 契约的能力采用 Route Handlers。三类入口均调用相同模块应用服务。

**Rationale**: App Router 是 Next.js 当前主路由模型，支持 Server Components、Suspense 和 Server Functions；Route Handlers 覆盖标准 HTTP 方法并适合文件与外部契约。入口与业务逻辑分离可避免 Server Action/HTTP 处理器成为领域层。

**Alternatives considered**:

- Pages Router：成熟但不是新项目首选，且会产生两套路由范式。
- 独立后端服务：对单用户首期增加部署、契约和运维成本，违背最小复杂度原则。
- 仅 Server Actions：文件流、导出下载和契约测试表达较弱。

## 2. 模块化单体

**Decision**: 单个 Next.js 部署单元，按 applications、analytics、data-transfer 三个业务模块切分；shared 只容纳真正通用能力。跨模块只能通过公开应用服务/DTO，不允许读取对方内部实现。

**Rationale**: 功能规模和团队规模不需要分布式系统，但投递、分析、数据迁移的变化原因不同，明确边界能控制耦合并允许未来拆分。

**Alternatives considered**:

- 按 controllers/services/repositories 全局分层：容易让单个业务改动横跨全仓库并造成领域规则散落。
- 微服务：首期没有独立扩缩容或组织边界收益。
- 单一 feature 文件夹：初期简单，但导入/统计会逐渐侵入核心写模型。

## 3. Supabase 与数据库访问

**Decision**: Supabase 作为 PostgreSQL 托管平台和本地开发工具。数据库迁移保存在 `supabase/migrations` 并通过 CLI 重放；TypeScript 数据库类型由 schema 生成。浏览器不直接查询业务表；Next.js 服务端使用仅服务端密钥和 `@supabase/supabase-js`。多表写入封装为 PostgreSQL 事务函数/RPC。

**Rationale**: 官方本地工作流支持将配置、迁移和 seed 纳入版本控制，并用 `db reset` 验证可重现性。首期明确无账号，直接下发可写 anon 权限会使公开部署中的个人数据无法隔离；服务端边界可以在不提前引入账号体系的情况下保护密钥并集中执行业务规则。

**Alternatives considered**:

- 浏览器直接使用 anon key + 宽松 RLS：无身份时无法安全区分访问者，拒绝。
- 立即引入 Supabase Auth：与首期“无需账号”冲突。
- ORM + 直连数据库：事务表达方便，但增加另一套 schema/type 抽象；当前 SQL 和生成类型足够。

## 4. 数据建模与历史

**Decision**: `applications` 保存当前快照；`application_stage_occurrences` 保存可重复阶段发生记录；`application_events` 保存状态、阶段和关键信息变化。数据库函数在同一事务内更新快照和追加事件。

**Rationale**: 快照使列表和统计查询直接高效，追加式事件满足回顾要求。阶段发生记录允许同类面试再次发生，而列表可按阶段代码去重聚合。

**Alternatives considered**:

- 完整事件溯源：审计能力强，但读模型、迁移和调试复杂度过高。
- 只存当前字段：无法可靠回顾过程。
- 应用表内 JSON 阶段数组：约束、查询和统计困难。

## 5. 搜索、分页与统计

**Decision**: 公司/岗位搜索使用标准化字段与 PostgreSQL `pg_trgm` GIN 索引；列表使用游标分页、白名单排序和服务端组合过滤；统计采用单次聚合查询/RPC。

**Rationale**: 目标只有 10,000 条记录，但部分匹配的前导通配符无法有效利用普通 B-tree。游标分页保持稳定，避免深 offset；数据库聚合避免把全部记录传给浏览器。

**Alternatives considered**:

- 客户端加载全部数据：简单但违反 10k 规模和性能预算。
- 外部搜索服务：数据量不足以抵消运维成本。
- 仅 B-tree：适合前缀/等值，不满足任意部分匹配。

## 6. 导入与导出格式

**Decision**: 首期导入 CSV 与 XLSX，导出 XLSX（并允许 CSV 作为轻量选项）。使用 SheetJS 解析/生成，限制 5MB 和 10,000 行。导入必须持久化预检批次，确认后逐行记录结果；原文件不长期保存。

**Rationale**: XLSX 符合用户对 Excel 的预期，CSV 提供开放兼容格式。持久化预检批次适配无状态部署，并允许用户在确认前查看错误和重复项。

**Alternatives considered**:

- 仅 CSV：实现更小但不完全符合 Excel 迁移体验。
- 浏览器内解析：减少服务端负载，但业务校验和敏感数据流分散、难以一致审计。
- 保存原始文件到对象存储：首期没有复用需求，增加数据保留风险。

## 7. 验证、日期与错误

**Decision**: Zod schema 定义传输边界验证，领域值对象执行跨字段规则，PostgreSQL 约束作为最终防线。业务日期用 `date`，系统时间用 `timestamptz`；首期业务时区固定为 `Asia/Shanghai`。接口统一返回字段错误和稳定错误代码。

**Rationale**: 多层验证分别服务于即时反馈、业务一致性和并发安全。区分自然日与系统时间可避免跟进阈值和“本周新增”受 UTC 偏移影响。

**Alternatives considered**:

- 只在客户端验证：可绕过且不能保证导入/API 一致性。
- 所有日期存时间戳：会给自然日语义引入不必要的时区错误。

## 8. 测试与质量工具

**Decision**: Vitest + Testing Library 覆盖领域和组件；本地 Supabase + pgTAP/Vitest 覆盖数据库与集成；Playwright + axe 覆盖关键旅程和 WCAG；固定 10k seed 做性能测试。

**Rationale**: 测试金字塔覆盖纯逻辑、数据库事实和真实浏览器行为，并直接响应宪章对 80% 覆盖率、关键 E2E、WCAG 2.2 AA 和性能预算的要求。

**Alternatives considered**:

- 只做 E2E：慢且难定位领域/数据库错误。
- Jest：可行，但 Vitest 对现代 TypeScript/ESM 配置更直接。

## 9. 版本与升级策略

**Decision**: 基线为 Node.js 24 LTS、Next.js 16.x、React 19.x、TypeScript 5.x；实现开始时选择各兼容线的最新补丁并由 lockfile 固定。依赖升级通过测试和性能门禁单独提交。

**Rationale**: 主/次版本表达规划期兼容边界，补丁版本由实现时锁文件提供可重现性和安全修复。

**Alternatives considered**:

- 在规划文档固定未来具体补丁：容易在实施前过期。
- 始终使用 latest：不可重现且增加升级风险。

## Primary References

- [Next.js App Router](https://nextjs.org/docs/app)
- [Next.js Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers)
- [Next.js Mutating Data](https://nextjs.org/docs/app/getting-started/mutating-data)
- [Supabase Local Development Workflow](https://supabase.com/docs/guides/local-development/cli-workflows)
- [Supabase CLI](https://supabase.com/docs/reference/cli/getting-started)
- [Supabase server package guidance](https://supabase.com/docs/guides/auth/choosing-a-server-package)
