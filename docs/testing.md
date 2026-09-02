# JobTrace 测试指南

本文说明测试层级、运行前提、临时数据库机制和发布门禁。所有命令均从仓库根目录执行。

## 测试矩阵

| 层级         | 命令                    | 范围                                                                |
| ------------ | ----------------------- | ------------------------------------------------------------------- |
| 格式         | `pnpm format`           | Prettier 检查源码、测试、根配置、GitHub 工作流、README 和 `docs/`。 |
| 静态检查     | `pnpm lint`             | Next.js/TypeScript 规则和模块依赖边界。                             |
| 类型         | `pnpm typecheck`        | TypeScript 严格模式，无代码输出。                                   |
| 单元         | `pnpm test`             | Vitest + jsdom + V8 覆盖率。                                        |
| 单元快速运行 | `pnpm test:unit`        | Vitest，不收集发布覆盖率。                                          |
| 数据库重放   | `pnpm db:reset:verify`  | 新建空库，重放全部迁移和种子并验证核心事件。                        |
| 类型漂移     | `pnpm db:types:check`   | 对比数据库结构与生成的 TypeScript 类型。                            |
| 数据库烟雾   | `pnpm db:test`          | 在事务中校验核心写函数、事件、owner 约束和分析函数。                |
| SQL 断言     | `pnpm db:sql:test`      | 用 pgTAP 执行 `supabase/tests/*.sql` 的数据库回归断言。             |
| 契约         | `pnpm contract`         | Route Handler 状态码、响应和错误契约。                              |
| 集成         | `pnpm integration`      | PostgreSQL 仓储、模块协作与 owner 隔离。                            |
| 端到端       | `pnpm e2e`              | Chromium 中的核心用户旅程、认证、后台与无障碍。                     |
| 数据性能     | `pnpm performance`      | 投递、面经和管理后台数据库基准。                                    |
| 认证性能     | `pnpm performance:auth` | 登录和管理后台 HTTP 性能。                                          |
| Lighthouse   | `pnpm lighthouse`       | 桌面首页三次运行，检查 LCP 与 CLS。                                 |
| 构建         | `pnpm build`            | Next.js standalone 生产构建。                                       |

## 前置环境

执行完整套件需要：

- 已完成 `pnpm install`；
- `.env.local` 中有可连接的测试 PostgreSQL `DATABASE_URL`；
- 数据库账号可以连接名为 `postgres` 的维护数据库，并具有 `CREATE DATABASE` 权限；
- Python 3.12 与 uv；
- 数据库服务器已安装 pgTAP（仅运行 `db:sql:test` 时需要）；
- Playwright Chromium：`pnpm exec playwright install chromium`。

> [!IMPORTANT]
> 本地测试连接串必须指向允许创建临时数据库的非生产 PostgreSQL 服务器。不要为运行测试而扩大生产应用账号权限。

## 临时数据库隔离

`contract`、`integration`、`e2e`、`performance` 和 `performance:auth` 都通过 `scripts/run_with_temp_database.py` 包装：

1. 从 `DATABASE_URL` 解析 PostgreSQL 服务器，并连接 `postgres` 维护库。
2. 创建名称随机的 `jobtrace_test_*` 数据库。
3. 按顺序执行全部 SQL 迁移。
4. 把子进程的 `DATABASE_URL` 替换为临时库连接串。
5. 无论测试成功或失败，都使用 `DROP DATABASE ... WITH (FORCE)` 删除临时库。

Playwright 套件使用不同端口和独立 Next.js 构建目录：

| 套件     | 端口 | 构建目录            |
| -------- | ---- | ------------------- |
| 契约     | 3001 | `.next-contract`    |
| 集成     | 3002 | `.next-integration` |
| 认证性能 | 3003 | `.next-performance` |
| E2E      | 3004 | `.next-e2e`         |

这种隔离允许测试之间不共享业务数据，也避免并行启动时覆盖默认 `.next`。Playwright 当前统一使用单 worker，以确保数据库场景和认证状态可重复。

### 直接数据库测试的区别

`pnpm db:test` 和 `pnpm db:sql:test` 直接连接 `.env.local` 指向的已迁移数据库。Python 烟雾校验和每个 pgTAP 文件都使用事务并回滚验证数据；仍应按可能接触当前数据库谨慎对待。需要验证完整迁移链时优先使用 `db:reset:verify`。

## 覆盖率与质量门槛

`pnpm test` 对领域规则、应用 schema、列表查询、分析规则、表格读写和 shared 纯工具收集覆盖率：

- 行覆盖率至少 80%；
- 分支覆盖率至少 80%。

端到端测试包含独立的无障碍场景，使用 `@axe-core/playwright`。Lighthouse CI 以 1280×800 桌面环境运行三次，要求：

- Largest Contentful Paint ≤ 2.5 秒；
- Cumulative Layout Shift ≤ 0.1。

数据库性能基准使用可重复种子，并覆盖大数据场景。当前管理后台读取 p95 门限为 2 秒、写入 p95 门限为 1 秒；面经主要列表、筛选、搜索和聚合更新 p95 门限为 1 秒。

## Raw 命令的安全边界

`package.json` 中的 `contract:raw`、`integration:raw`、`e2e:raw`、`performance:raw` 和 `performance:auth:raw` 不创建临时数据库，而是直接使用当前 `DATABASE_URL`。

> [!WARNING]
> Raw 变体仅用于定位包装器或特定数据库问题。运行前必须确认连接串目标。性能脚本必须把种子和测量放在同一事务并在 `finally` 回滚，严禁加入 `commit()`。

一般开发和 CI 应始终使用不带 `:raw` 的包装命令。

## 推荐工作流

### 日常改动

```bash
pnpm format
pnpm lint
pnpm typecheck
pnpm test
```

再按变更范围选择集成或 E2E。例如，修改 SQL 函数至少运行 `db:reset:verify`、`db:test` 和相关集成测试；修改登录或 owner 隔离还应运行认证与跨用户 E2E。

### 发布前

```bash
pnpm format
pnpm lint
pnpm typecheck
pnpm test
pnpm db:reset:verify
pnpm db:types:check
pnpm db:test
pnpm db:sql:test
pnpm contract
pnpm integration
pnpm e2e
pnpm performance
pnpm performance:auth
pnpm build
pnpm lighthouse
```

CI 执行格式、lint、类型、Python 语法、单元测试、迁移、Python/pgTAP 数据库校验、空库重放、类型漂移、契约、集成、构建、E2E、数据与认证性能以及 Lighthouse。

## 失败排查

- 临时库创建失败：检查账号的 `CREATE DATABASE` 权限和对 `postgres` 的连接权限。
- Playwright 找不到浏览器：运行 `pnpm exec playwright install chromium`；Linux CI 可使用 `--with-deps`。
- Web Server 超时：先运行 `pnpm db` 和 `pnpm dev`，检查 `/api/health` 与认证环境变量。
- 类型漂移：确认迁移已全部应用；有意变更时用 `pnpm db:types` 重新生成并审阅差异。
- 偶发性能失败：检查系统负载和数据库缓存，再比较数据库 `EXPLAIN (ANALYZE, BUFFERS)` 与端到端耗时，不要直接放宽门限。
- E2E 失败：Playwright 在失败时保留 trace；优先检查 trace、页面错误和 `x-request-id`，不要输出敏感请求正文。

## 测试数据隐私

所有 fixture 和性能种子都应使用虚构公司、账号和面经。日志和失败快照不得包含真实 Cookie、Session、密码、token、投递备注或面经正文。若历史版本遗留性能数据，必须先核对 owner、精确前缀和数量，再在事务中清理，禁止用模糊条件删除真实记录。

## 相关配置

- `vitest.config.ts`：单元测试和覆盖率。
- `playwright.config.ts`：E2E。
- `playwright.contract.config.ts`：契约测试。
- `playwright.integration.config.ts`：集成测试。
- `playwright.performance.config.ts`：认证性能。
- `lighthouserc.json`：Lighthouse 门禁。
- `.github/workflows/ci.yml`：持续集成。

## 自动招聘市场测试规则

生产默认目录需要通过唯一标识、HTTPS URL、主机白名单和中国国家代码范围一致性测试；持久化测试需要验证重复初始化不会产生重复数据、保留管理员设置的暂停/撤销状态，并撤销已移出默认目录的旧来源。不要将目录验证改为 CI 实时联网测试：ATS 可用性属于外部不确定因素。目录变更前人工验证候选端点，适配器行为继续通过 `tests/fixtures/job-market/` 下的固定数据覆盖。

ATS、Moka、小米和 Schema.org 适配器测试只能读取本地 fixture 或内存响应，不能请求真实招聘站点。每个新适配器至少覆盖正常分页、多地点、缺省字段、部分坏数据、关闭/重开和限流；安全夹具还要覆盖私网 IPv4/IPv6、元数据、DNS 指向私网、重定向复验、userinfo、重定向循环、超大响应和危险投递 URL。

岗位市场变更至少运行：

```bash
pnpm exec vitest run tests/unit/job-market tests/component/job-market
pnpm contract
pnpm integration
pnpm e2e
pnpm performance
pnpm performance:auth
```

契约、集成和 E2E 包装命令创建隔离临时数据库。100 家企业/100,000 岗位性能种子与测量位于同一事务，并故意回滚。岗位市场读接口 p95 门限为 500ms，收藏/私人记录写为 1s；Playwright 和 Lighthouse 共同检查 LCP 2.5s、INP 200ms、CLS 0.1。axe 在桌面与移动视口运行，并以键盘覆盖筛选、收藏、选择岗位和管理来源。

Vitest 的全局行、分支覆盖率均不得低于 80%；新增领域规则必须有分支测试，数据库 owner 隔离和租约竞争必须有 PostgreSQL 集成测试，不能用组件 mock 代替。
