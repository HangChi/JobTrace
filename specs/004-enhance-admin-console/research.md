# Research: 管理员后台增强

## Decision 1: 扩展现有 identity-access 模块

- **Decision**: 管理员摘要、用户查询、访问变更和审计查询继续位于 `src/modules/identity-access`，通过新增应用服务和单一 PostgreSQL 管理仓储扩展；不创建独立后台应用。
- **Rationale**: 角色、Session、用户资料、最后管理员保护和现有审计都属于身份访问边界。沿用模块化单体能复用 `requireAdmin`、Problem 错误、数据库与 UI 原语，并避免跨服务一致性问题。
- **Alternatives considered**: 建立独立 admin 服务或通用 admin 框架；被拒绝，因为当前规模只有 10,000 用户、单部署单元和少量管理用例，引入独立认证边界与运维成本没有收益。

## Decision 2: Server Component 首屏读取，URL 保存查询状态

- **Decision**: 后台页面保持 Server Component；`searchParams` 和动态 `params` 按 Next.js 16 的 Promise 约定解析。关键词、筛选和页码写入 URL，客户端组件只负责交互与渐进式导航。
- **Rationale**: 当前项目已经使用 App Router 服务端读取；URL 能自然支持刷新、返回和分享筛选状态，并减少客户端数据层。Next.js 16 本地文档确认动态参数为 Promise，认证数据应在靠近数据源的访问层授权。
- **Alternatives considered**: 整个后台改成 Client Component 并维护本地查询缓存；被拒绝，因为会扩大客户端 JavaScript、重复授权/错误状态逻辑，并使刷新恢复更复杂。

## Decision 3: 管理员数据保持请求时动态且不跨用户缓存

- **Decision**: 后台页面和 Route Handler 每次请求重新读取数据库 Session、角色和数据；不为用户目录、审计或摘要启用静态缓存或共享数据缓存。
- **Rationale**: 角色、禁用状态和审计都是安全敏感且变化后需立即可见。Next.js 16 Route Handlers 默认不缓存，当前 `next.config.ts` 未启用 Cache Components；保持请求时读取最符合现有行为。
- **Alternatives considered**: 对摘要做分钟级共享缓存；被拒绝，因为会引入禁用/角色变更后的陈旧数据与缓存失效复杂度，当前数据规模可以通过索引和聚合查询满足预算。

## Decision 4: 只返回最小管理员 DTO

- **Decision**: 管理员用户列表与详情仅返回账号标识、角色、状态、时间、访问版本、投递/面经数量和最近审计摘要；不返回业务正文、Session、IP、user-agent 或认证凭据。
- **Rationale**: Next.js 认证指南建议在数据访问层集中授权并使用 DTO 最小化返回字段；这也直接落实规格的隐私边界和避免意外序列化。
- **Alternatives considered**: 复用完整用户/Profile/业务实体；被拒绝，因为会把未使用的敏感字段带到传输与客户端边界，扩大泄露面。

## Decision 5: 使用 access_version 进行账号访问乐观并发

- **Decision**: 在 `users` 增加只随角色/禁用状态变化递增的 `access_version`；每个变更携带 `expectedVersion`，数据库锁定目标后比较版本。
- **Rationale**: 现有 `updated_at` 可能因资料或认证库操作变化，不能精确表达管理员看到的访问状态。专用版本可确定性拒绝陈旧操作且不覆盖另一管理员的新决定。
- **Alternatives considered**: 仅用 `updated_at` 或最后写入覆盖；前者耦合无关资料变化，后者违反并发冲突需求，因此拒绝。

## Decision 6: 使用 requestId 实现幂等重放

- **Decision**: 每个管理变更由客户端生成 UUID `requestId`，审计表唯一保存该 ID 与请求指纹；相同载荷重试返回原结果，不重复变更，相同 ID 的不同载荷返回冲突。
- **Rationale**: 浏览器超时或网络中断可能让结果未知。稳定请求 ID 同时解决重复点击、响应丢失后的安全重试和审计关联。
- **Alternatives considered**: 只在按钮 pending 时禁用；被拒绝，因为无法覆盖重连、刷新、多标签或响应在提交后丢失的情况。

## Decision 7: 一个命令只执行一个访问动作

- **Decision**: 访问变更使用 `promote_admin`、`demote_admin`、`disable_user`、`enable_user` 四个具名动作，而不是允许一次 PATCH 任意组合 `role` 和 `disabled`。
- **Rationale**: 一个意图对应一个确认文案、原因、审计事件和结果，避免同一请求同时产生两类事件或出现部分语义。它也使最后管理员与自我操作规则更容易测试。
- **Alternatives considered**: 保留自由字段 PATCH；被拒绝，因为角色和状态同时变化时影响难以清楚确认，审计与幂等重放也更复杂。

## Decision 8: 业务拒绝与成功都由原子函数形成审计

- **Decision**: 数据库原子函数对已授权且结构有效的命令返回 `succeeded`、`denied` 或 `conflict` 结果；已知业务拒绝不抛出导致整个事务回滚，而是在同一调用中追加审计。成功时状态更新、版本递增、Session 撤销和审计同一事务提交。
- **Rationale**: 现有函数对最后管理员规则抛异常，无法保留拒绝事件。显式结果既满足审计完整性，又保证成功写入的原子性。意外数据库不可用无法可靠自审计，因此另以去敏结构化服务日志记录并允许同 requestId 重试。
- **Alternatives considered**: 应用层先写失败审计再尝试变更；被拒绝，因为进程中断会产生错误结果，且无法与数据库状态原子一致。

## Decision 9: 审计保存身份快照且保持追加不可变

- **Decision**: 扩展 `admin_audit_events` 保存 actor/target 当前外键和事件时账号快照，外键改为可空 `ON DELETE SET NULL`，继续用触发器禁止 UPDATE/DELETE。
- **Rationale**: 当前非空外键会阻止未来用户删除，且账号改名后不能还原事件时身份。快照保证历史可辨认，当前外键则在账号仍存在时支持详情关联。
- **Alternatives considered**: 只保存外键或只保存文本；前者丢失历史语义，后者失去当前关联，两者均不完整。

## Decision 10: 采用稳定页码分页与针对性索引

- **Decision**: 用户和审计使用带总数的页码分页，分别按 `created_at desc, id desc` 稳定排序；规范化用户名/邮箱使用 trigram 搜索索引，角色/状态/注册时间和审计筛选使用组合 B-tree 索引。
- **Rationale**: 规格要求页码保留和匹配总数；10,000/100,000 规模下受控 offset 与覆盖索引可满足 2 秒目标，且与现有管理页面迁移成本最低。
- **Alternatives considered**: 游标分页；在无限滚动与超大数据集更优，但不便直接恢复页码和展示总页数，因此本范围不采用。

## Decision 11: 活跃口径基于有效登录 Session 创建

- **Decision**: 最近 7/30 天活跃用户按窗口内至少创建一次 Session 的不同未禁用用户计算；30 天趋势按 `Asia/Shanghai` 自然日聚合，注册趋势按 `users.created_at`。
- **Rationale**: 现有数据库没有独立活动事件，Session 创建是可验证且不读取个人业务内容的最小代理；口径能直接向管理员说明。
- **Alternatives considered**: 以任何业务写入或页面请求作为活跃；被拒绝，因为需要新增全站行为追踪、扩大隐私范围并增加写入负担。

## Decision 12: 复用现有多层测试与可观测性

- **Decision**: 延续 Vitest/Testing Library、临时 PostgreSQL、Playwright contract/E2E/axe、性能脚本和 Lighthouse；服务日志记录去敏 ID、动作、结果码和耗时，审计原因不复制到日志。
- **Rationale**: 仓库已有身份生命周期、越权、Session 撤销、Web Vitals 和临时库性能基线，扩展它们比引入新测试/观测工具更一致。数据库并发和原子性在集成层验证，用户反馈在组件/E2E 验证。
- **Alternatives considered**: 仅做 E2E 或引入新的审计/遥测服务；前者难以确定性覆盖并发和约束，后者超出范围且增加秘密与数据治理成本。
