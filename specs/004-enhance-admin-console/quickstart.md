# Quickstart & Validation: 管理员后台增强

本指南用于实现完成后的端到端验证。HTTP 字段与错误见 [contracts/openapi.yaml](./contracts/openapi.yaml)，持久化约束与状态变化见 [data-model.md](./data-model.md)。

## Prerequisites

- Node.js 24 LTS、pnpm、Python 3.12 与 uv
- 可访问的 PostgreSQL 实例以及项目认证环境变量
- 至少两个管理员账号、一个普通账号和一个禁用账号
- 支持的桌面浏览器及 375px/768px 设备模拟

## 1. Configure and migrate

```bash
pnpm install
pnpm db
pnpm db:types
pnpm db:test
pnpm typecheck
```

预期：迁移可在空库和包含旧审计事件的现有库上重放；旧审计完成 request ID/身份快照回填；访问版本、外键、索引、只追加触发器和原子管理函数均通过验证；生成类型无漂移。

## 2. Run quality gates

```bash
pnpm format
pnpm lint
pnpm typecheck
pnpm test
pnpm db:reset:verify
pnpm db:types:check
pnpm db:test
pnpm contract
pnpm integration
```

预期：格式、静态检查、单元/组件、数据库、集成与 HTTP 契约全部通过；变更代码行覆盖率和分支覆盖率均不低于 80%。

## 3. Start and verify access boundaries

```bash
pnpm dev
```

1. 未登录访问 `/admin`、`/admin/users`、`/admin/audit` 和对应接口，确认没有管理数据泄露。
2. 普通用户访问相同入口，确认页面回到普通业务区，接口返回 403。
3. 禁用管理员的旧 Session 访问后台，确认被拒绝。
4. 有效管理员登录后确认进入后台，管理员布局突出当前页面且普通业务数据仍只按管理员自己的 owner 展示。

## 4. Journey A — Operational overview

1. 准备普通、管理员、禁用用户，以及跨最近 7/30 天的注册和登录 Session。
2. 打开 `/admin`，核对用户总数、有效/禁用/管理员数、投递数和面经数。
3. 核对 7/30 天新增与活跃用户，以及最近 30 个上海时区自然日趋势。
4. 使用空数据库样本确认真实零值显示为 0；模拟某个摘要查询失败，确认显示“暂不可用”而不是 0。
5. 确认页面展示生成时间、`Asia/Shanghai` 和“有效登录 Session”活跃口径。

## 5. Journey B — User discovery and detail

1. 准备相似用户名、不同内部邮箱、角色、状态和注册日期的用户。
2. 在 `/admin/users` 使用完整/部分用户名或内部邮箱检索，并组合角色、状态和注册日期。
3. 翻页、刷新并打开详情后返回，确认 URL、筛选和页码保持一致；不存在页码回到有效范围。
4. 核对匹配总数、稳定顺序、从未登录标签、投递/面经数量，确认连接多个业务表不会重复计数。
5. 打开 `/admin/users/{id}`，确认账号档案可分页展开投递备注、阶段和面经复盘；列表页仍不出现正文，详情不提供编辑、删除或导出，页面与网络响应不含简历、附件、Session、IP 或 user-agent。

## 6. Journey C — Safe access changes

1. 提升普通用户为管理员，确认对话框展示目标、当前/目标状态、影响并要求 10–500 字符原因。
2. 使用返回的访问版本将其降级，确认版本递增且列表、详情和审计同步刷新。
3. 禁用已登录普通用户，确认同一事务后其全部 Session 消失，新请求和新登录均被拒绝。
4. 重新启用用户，确认可以重新登录，但旧 Session 不会恢复。
5. 尝试禁用或降级最后一个有效管理员，确认返回冲突、账号不变且存在 denied 审计。
6. 存在另一管理员时执行自我降级/禁用：缺少强化确认时拒绝并审计；确认后成功且当前管理会话立即失效。

## 7. Journey D — Concurrency and idempotency

1. 两个管理员打开同一目标详情并取得相同 `accessVersion`。
2. 管理员 A 完成变更后，管理员 B 使用旧版本提交，确认收到版本冲突、看见最新安全状态且无法覆盖。
3. 模拟成功响应在浏览器接收前中断，使用相同 `requestId` 和相同载荷重试，确认返回 `replayed=true`，版本和审计事件均只增加一次。
4. 使用相同 `requestId` 提交不同动作或原因，确认幂等冲突且账号不变。
5. 快速重复点击确认，确认只有一个请求产生状态变化。

## 8. Journey E — Audit review

1. 生成成功、最后管理员拒绝、自我确认拒绝和并发冲突事件。
2. 打开 `/admin/audit`，核对时间、操作者、目标、动作、前后访问状态、原因、结果和失败码。
3. 依次按操作者、目标、动作、结果和日期范围筛选，再组合筛选并核对总数/分页。
4. 验证审计页面和接口不存在编辑、删除或导出能力；数据库 UPDATE/DELETE 仍由触发器拒绝。
5. 在隔离样本中删除已引用用户，确认历史事件保留身份快照并标注账号已删除。

## 9. Accessibility and responsive validation

1. 仅使用键盘完成管理员导航、筛选、翻页、打开详情、填写原因、强化确认、错误恢复和关闭对话框。
2. 确认对话框开启时焦点进入、关闭后返回触发元素；pending、成功、冲突和失败均由辅助技术播报。
3. 在 375px、768px、1280px 检查摘要、用户和审计列表；窄屏使用具名字段卡片或可访问替代布局，不截断关键操作。
4. 运行 axe，检查表单标签、错误关联、表格/卡片语义、焦点、对比度和非颜色状态提示。

## 10. Performance and security validation

使用隔离临时数据库生成 10,000 用户、分布式 Session、相应业务计数和 100,000 审计事件；预热后至少测量九次并取 p95，测试完成强制删除临时库：

- 用户关键词/组合筛选、页码跳转、详情与审计组合筛选 p95 ≤2 秒。
- 账号访问变更反馈 p95 ≤1 秒，禁用成功后的后续受保护请求拒绝率 100%。
- 后台 LCP p75 ≤2.5 秒、INP p75 ≤200ms、CLS ≤0.1。
- 访客、普通用户和禁用管理员对所有后台接口的拒绝率 100%，响应与日志均无敏感字段。
- 服务日志只包含 request ID、actor/target ID、动作/查看分页、结果数量、结果码和耗时；不得出现搜索文本、原因、邮箱、Cookie、Session、IP/user-agent 或求职正文。

运行完整发布门禁：

```bash
pnpm e2e
pnpm performance
pnpm performance:auth
pnpm lighthouse
pnpm build
```

任一授权、并发、审计、覆盖率、可访问性或性能门禁失败都阻止发布。

## 11. Rollback drill

1. 备份现有数据库并部署扩展式迁移，确认旧管理员读取仍可运行。
2. 发布新应用并完成摘要、一次成功变更和审计读取冒烟验证。
3. 模拟应用回滚到上一构建，确认旧页面仍可读取用户、最后管理员保护仍有效且已有 Session/审计不丢失。
4. 不删除 `access_version`、扩展审计列或新事件；若管理写入异常，临时关闭管理变更入口并保留只读审计与普通业务能力。

## Validation Record — 2026-08-24

- 环境：Node.js 24、Next.js 16.3.0、PostgreSQL 17；所有契约、集成、E2E 和性能测试均使用一次性隔离数据库并在结束后删除。
- 静态与构建：`pnpm format`、`pnpm lint`、`pnpm typecheck`、`git diff --check`、`pnpm build` 全部通过；管理员页面与接口均被识别为动态路由。
- 单元/组件：`pnpm test` 49 个文件、152 项测试全部通过；语句/行覆盖率 96.8%，分支覆盖率 86.11%。
- 数据库：`pnpm db:reset:verify` 空库重放通过；`pnpm db:types:check` 无漂移；`pnpm db:test` 的原子事件、阶段/面经聚合、owner 约束与分析检查全部通过。新增迁移还由管理员 SQL、集成与契约测试覆盖访问版本、幂等、最后管理员、Session 撤销和只追加审计。
- HTTP 契约：`pnpm contract` 21/21 通过，覆盖管理员摘要、用户列表/详情、访问变更、审计查询及 400/401/403/404/409 Problem。
- 集成：`pnpm integration` 24/24 通过，覆盖上海时区 30 天补零趋势、稳定分页、原子权限变更、旧版本冲突、幂等重放、最后管理员保护、审计快照和安全日志。
- 浏览器：`pnpm e2e` 50/50 通过；管理员授权矩阵、检索/详情/变更/审计旅程、375/768/1280px、键盘对话框焦点、axe WCAG 检查和 owner 隔离均通过。
- 性能：`pnpm performance` 在 10,000 用户、分布 Session/业务计数及 100,000 审计事件下通过。管理员 p95：摘要 29.68ms、用户筛选 37.60ms、详情 25.55ms、审计筛选 25.91ms、访问变更 59.18ms，均显著低于 2s/1s 门限。
- 认证与页面性能：`pnpm performance:auth` 1/1 通过；Lighthouse 使用生产构建运行 3 轮，LCP ≤2.5s 与 CLS ≤0.1 断言全部通过。
- 回滚演练：空库重放验证扩展式迁移；生产构建与一次性数据库完成新应用冒烟；运维文档明确只回滚应用、保留 `access_version`、访问函数和全部审计记录，并可关闭管理写入口保留只读审计。
