# Quickstart Validation: 自动招聘岗位市场

本指南用于实现完成后的本地和 CI 验收。数据结构见 [data-model.md](data-model.md)，HTTP 细节见 [contracts/openapi.yaml](contracts/openapi.yaml)，来源行为见 [contracts/source-adapter.md](contracts/source-adapter.md)。

## Prerequisites

- Node.js 24、pnpm 与 PostgreSQL 17。
- 已安装项目依赖并可运行现有测试。
- 本地测试只使用 `tests/fixtures/job-market/` 和测试 mock server；不要把真实企业招聘站点作为自动化测试依赖。
- 为内部调度设置一个仅本地使用的随机 `JOB_MARKET_SYNC_SECRET`。不要提交或打印该值。
- 功能实现后应在 `.env.example` 和运维文档中说明 `JOB_MARKET_ENABLED`、`JOB_MARKET_SYNC_SECRET`、同步批量大小和安全超时配置。

## Setup and quality checks

从仓库根目录执行项目已有的安装、数据库初始化和迁移命令，然后运行：

```bash
pnpm format
pnpm lint
pnpm typecheck
pnpm test
pnpm contract
pnpm integration
pnpm e2e
```

如果实际 `package.json` 使用不同脚本名，以仓库脚本为准；实现任务必须补齐能独立运行 job-market 单元、契约、集成和 E2E 测试的命令。变更代码覆盖率应达到行和分支各 80%。

## Scenario 1: Automatic sync to homepage

1. 启动 PostgreSQL、应用和本地来源 fixture server。
2. 以管理员登记至少两个公司来源：一个完整成功、一个部分含坏数据。
3. 使用内部 Bearer 密钥调用一次受保护的调度接口：

```bash
curl --fail-with-body \
  -X POST http://localhost:3000/api/internal/job-market/sync \
  -H 'Authorization: Bearer <local-job-market-sync-secret>' \
  -H 'Content-Type: application/json' \
  -d '{"limit":10}'
```

4. 以普通用户打开 `/`。

Expected:

- 无需上传文件，招聘活动自动出现。
- 同一企业同一批次只有一行/卡片；岗位名和地点去重合并，展开后能看到所有底层岗位。
- 部分坏数据被隔离，健康岗位仍导入；来源显示最近确认时间和 `partial` 运行。
- 页面不存在来源 HTML 脚本或危险链接。

## Scenario 2: Search, filter, and compact aggregation

1. Fixture 创建同一批次的多个岗位和地点，并创建同公司另一个独立批次。
2. 分别使用岗位关键词、第二个地点、公司、招聘类型、发布时间和有效状态筛选。
3. 展开和折叠长岗位/地点集合，然后清除筛选。

Expected:

- 任一底层岗位或地点命中即可返回所属活动，但活动不拆成多行。
- 独立批次始终分开。
- 筛选状态可见，展开不会改变命中、收藏或选中的投递目标。
- 空结果提供“清除筛选”，加载、过期和错误状态均有明确反馈。

## Scenario 3: Direct application links

1. 为活动 A 提供一个统一安全官方链接；为活动 B 提供多个岗位专属链接；为活动 C 提供无链接、HTTP 链接或已知失效链接。
2. 在列表中操作“立即投递”。

Expected:

- A 不进入详情，直接用带 `noopener,noreferrer` 的新页面打开官方 HTTPS 地址。
- B 在同一聚合记录中先选择岗位，再直接打开对应官方地址，不产生重复公司行。
- C 的按钮禁用并说明原因，不把不安全 URL 作为普通可点击文本暴露。
- 关闭或过期岗位不能作为有效投递目标。

## Scenario 4: Create a private application

1. 用户甲从一个底层岗位选择“记录投递”，确认预填公司、岗位、地点、链接、投递日期和初始状态。
2. 再次对同一岗位执行操作。
3. 用户乙打开同一招聘活动。
4. 将公共岗位改名或关闭。

Expected:

- 第一次产生私人投递和 `application_job_market_links`；第二次返回冲突并提供现有投递入口。
- 用户乙看不到用户甲的日期、状态、阶段、备注、收藏或面试数据。
- 公共岗位变化不会修改用户甲已保存的私人快照和进度。

## Scenario 5: Favorites

1. 用户收藏一个活动，刷新和重新登录后启用“仅看收藏”。
2. 另一用户查看该活动。
3. 将活动全部岗位推进为关闭。

Expected:

- 收藏仅对所属用户持久化，另一用户状态独立。
- 已关闭活动仍可在收藏历史看到，并清楚标为失效且不能误导投递。

## Scenario 6: Lifecycle and idempotency

依次运行：初次快照、相同快照、更新快照、第一次完整缺失、相隔至少 6 小时的第二次完整缺失、重新出现、来源请求失败。

Expected:

- 相同快照不创建重复岗位或事件噪音。
- 更新、`stale`、`closed`、`reopened` 各产生可解释事件。
- 一次完整缺失仅过期；第二次确认才关闭。
- 请求失败不推进任何岗位下架，且最后成功数据保持可浏览。

## Scenario 7: Admin operations and multi-instance claim

1. 管理员查看来源健康和最近运行计数。
2. 同时发起两个内部调度请求，验证同一来源只被一个 worker 认领。
3. 模拟超时、429、无效内容和租约过期，然后对单个失败来源重试。
4. 暂停/撤销来源并再次运行调度。

Expected:

- 管理页显示最近尝试/成功、变化量和不含秘密/个人信息的错误摘要。
- 并发调用不重复同步；过期租约可安全恢复。
- 单来源失败和重试不阻塞招聘广场读取。
- paused/revoked 来源不会被计划任务认领。

## Scenario 8: Security regressions

使用 fixture 覆盖：回环地址、RFC1918、IPv6 链路本地、云元数据地址、DNS 指向私网、公开 URL 重定向到私网、userinfo URL、超过 3 次重定向、超过 5MB 响应、错误内容类型、脚本/事件处理器和非 HTTPS 投递链接。

Expected: 所有请求在访问受保护目标前被拒绝，安全错误码进入运行记录；响应、日志和 UI 不包含 Bearer 密钥、Cookie、原始响应正文或个人联系人信息。

## Scenario 9: Accessibility and responsive behavior

在项目支持的移动和桌面视口运行 axe/Playwright，并只用键盘完成筛选、清除、展开、收藏、岗位选择和记录投递。

Expected: 可见焦点、正确标签和语义、状态消息可被辅助技术感知、弹层焦点被管理、颜色对比满足 WCAG 2.2 AA，移动端无关键内容或操作丢失。

## Scenario 10: Performance gates

准备 100 家企业、100,000 个岗位/来源记录及代表性收藏数据，运行招聘广场读、收藏/记录投递写、并发后台同步和页面性能脚本。

Expected:

- GET 列表/详情 ≤500ms p95；收藏和记录投递 ≤1s p95。
- 95% 的筛选在 2s 内完整呈现。
- LCP ≤2.5s p75、INP ≤200ms p75、CLS ≤0.1。
- 同步运行时交互预算不回退；超预算必须阻止发布或记录符合宪章的限时例外。

## Scheduler and operational acceptance

部署环境每 5 分钟调用内部同步接口；运行时密钥由秘密管理系统注入，不能放在 cron 配置日志或仓库。告警至少覆盖连续失败、12 小时未成功、租约长期未释放和单次数据量突变。健康检查不应依赖任何外部招聘源在线。

## Rollback drill

1. 停止外部 cron。
2. 设置 `JOB_MARKET_ENABLED=false` 并暂停所有来源。
3. 验证 `/applications`、现有分析和面试流程仍可使用。
4. 保留新增表和事件用于审计，不做破坏性回滚；修复后重新启用少量来源验证。

Expected: 招聘广场停止暴露新入口或进入维护状态，公共同步停止，任何既有私人投递数据均不丢失。
