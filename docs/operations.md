# JobTrace 运行与运维

本文覆盖本地环境、生产配置、数据库迁移、部署、备份恢复、监控和常见故障。架构与安全边界见[架构文档](architecture.md)，测试环境见[测试指南](testing.md)。

## 本地环境

### 前置要求

- Node.js 24 与 pnpm 10
- PostgreSQL 17
- Python 3.12 与 uv

准备一个空数据库，并确保 `DATABASE_URL` 对它拥有建表、建类型、建函数和读写权限。然后执行：

```bash
pnpm install
cp .env.example .env.local
pnpm db
pnpm dev
```

访问 <http://localhost:3000>。`.env.local` 只放在仓库根目录，已被 Git 忽略；修改后需重启应用。浏览器地址的来源必须与 `BETTER_AUTH_URL` 一致。

## 配置

### 核心配置

| 变量                                | 生产要求                                                                                                                      |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                      | 指向 PostgreSQL 17；启用 TLS 时按数据库供应商要求加入连接参数。应用进程每实例最多建立 10 个业务连接，Better Auth 另有连接池。 |
| `BETTER_AUTH_SECRET`                | 至少 32 个字符，使用密码学安全随机值，通过密钥管理服务注入。轮换会影响现有认证状态，应在维护窗口执行。                        |
| `BETTER_AUTH_URL`                   | 与用户实际访问的规范来源完全一致，生产环境使用 HTTPS；同源写请求会据此校验 `Origin`。                                         |
| `AUTH_CHALLENGE_VERIFY_URL`         | 可选。配置后，登录和注册必须提供 `x-auth-challenge`，服务端以 JSON 调用该端点。                                               |
| `AUTH_CHALLENGE_SECRET`             | 按 CAPTCHA 服务要求设置，不得暴露给浏览器。                                                                                   |
| `AUTH_EMAIL_DELIVERY_URL`           | 生产必填。接收 `password_reset` 或 `email_verification_code` 投递任务；注册验证码和密码恢复共用。                             |
| `AUTH_EMAIL_DELIVERY_SECRET`        | 可选。作为 Bearer 凭据调用邮件投递 Webhook，不得暴露给浏览器。                                                                |
| `AUTH_EMAIL_VERIFICATION_TEST_CODE` | 仅限隔离测试。生产环境会忽略该值，不得把固定验证码用于真实流量。                                                              |

> [!WARNING]
> `DATABASE_URL`、`BETTER_AUTH_SECRET`、`AUTH_CHALLENGE_SECRET` 和所有 COS 凭据都只能作为服务端变量存在，不得添加 `NEXT_PUBLIC_` 前缀。

登录、注册和密码恢复共享 PostgreSQL 限流状态，可在多实例部署中保持一致。反向代理必须覆盖而不是透传客户端伪造的 `X-Forwarded-For` / `X-Real-IP`，也可以在可信网关叠加更严格的限流。每个应用实例默认使用 8 条业务连接和 2 条认证连接；多实例部署应通过 `DATABASE_APP_POOL_MAX`、`DATABASE_AUTH_POOL_MAX` 控制总连接数不超过 PostgreSQL 预算。

### 头像存储

头像通过服务端签名请求上传到腾讯云 COS。需要配置：

- `COS_SECRET_ID` 与 `COS_SECRET_KEY`
- `COS_BUCKET`，包含 APPID 后缀
- `COS_REGION`，例如 `ap-shanghai`
- 可选 `COS_PUBLIC_BASE_URL`

使用仅允许目标桶或 `avatars/` 前缀对象上传的子账号凭据，不要使用主账号永久密钥。头像 URL 需要公开读取，因此应为目标前缀配置只读访问策略。未配置 COS 时，除头像上传外的功能仍可使用。

### 登录邮箱、验证码与会话

新注册必须提供邮箱和 6 位验证码，验证码有效期 10 分钟、最多尝试 5 次，并按来源 IP 与邮箱共享 PostgreSQL 限流。登录框同时接受已验证邮箱或用户名。历史迁移会把已有恢复邮箱标记为已验证，因此升级不会阻断已注册用户；没有邮箱的历史用户仍可继续使用用户名登录。

个人中心支持绑定、换绑和解绑邮箱。绑定/换绑需要新邮箱验证码与当前密码，解绑需要当前密码；解绑后仍可使用用户名登录，但无法通过邮箱找回密码。忘记密码入口始终返回不枚举账号的统一提示；存在账号时，Better Auth 生成一小时有效的单次 token，并通过邮件投递 Webhook 发送重置链接。

仓库内的 `deploy/mail-adapter` 提供可直接用 Docker Compose 启动的 SMTP Webhook，支持 `password_reset` 与 `email_verification_code` 两种模板。复制其 `.env.example` 为 `.env` 后填入 SMTP 授权码和随机 Bearer 密钥，服务默认仅监听 `127.0.0.1:5590`。

个人中心可查看所有未过期会话并逐个撤销；修改密码会撤销其他设备的会话。邮箱、验证码、重置 URL、投递凭据和 Session 都不得写入日志。

## 数据库生命周期

### 应用迁移

`pnpm db` 按文件名顺序执行 `supabase/migrations/*.sql`，并在 `jobtrace_meta.schema_migrations` 保存版本和 SHA-256 校验和：

```bash
pnpm db
```

已执行迁移的内容发生变化时，迁移器会报告 `Migration drift detected` 并停止。不要修改已发布迁移；新增一个时间戳更大的迁移文件。

### 空库重放与类型漂移

发布前执行：

```bash
pnpm db:reset:verify
pnpm db:types:check
pnpm db:test
pnpm db:sql:test
```

`db:reset:verify` 会通过连接串中的服务器创建临时数据库，因此账号还需具有 `CREATE DATABASE` 权限，并能连接名为 `postgres` 的维护数据库。`db:types:check` 直接读取当前已迁移数据库，并检查 `src/generated/database.types.ts` 是否与其一致；`db:test` 也直接连接当前数据库，但验证写入会在结束时回滚。`db:sql:test` 运行 `supabase/tests/*.sql`，数据库服务器必须安装 pgTAP；CI 会在 PostgreSQL 服务容器中安装对应扩展包。

若数据库结构有意变更，先在干净迁移链上确认结果，再运行 `pnpm db:types` 更新生成类型并提交差异。

### 旧单用户数据归属

升级早期单用户数据时，不得按注册顺序推断 owner：

1. 完成数据库备份。
2. 注册目标用户并取得其 UUID。
3. 在环境中显式设置 `MIGRATION_OWNER_ID`。
4. 用 `pnpm db:owner:test` 在临时数据库演练。
5. 核对缺失、无效 owner 和预期回填数量。
6. 运行 `pnpm db:owner:migrate`，再运行 `pnpm db` 应用后续约束。

### 备份与恢复

PostgreSQL 备份是完整恢复路径；投递表格导出不包含面经关联、Session、审计和全部历史事件，不能替代数据库备份。

创建逻辑备份：

```bash
pg_dump --format=custom --file=jobtrace-YYYYMMDD.dump "$DATABASE_URL"
```

恢复演练应使用新建空数据库，避免覆盖生产数据：

```bash
createdb jobtrace_restore_check
pg_restore --dbname=jobtrace_restore_check jobtrace-YYYYMMDD.dump
```

至少在每次发布前和定期计划中执行备份，并实际验证恢复后的迁移版本、用户数量、投递数量、面经数量和审计数量。备份文件按敏感个人数据管理并设置保留期。

## 账号与管理员

### 引导首个管理员

先公开注册目标用户名，再使用内部邮箱：

```bash
pnpm admin:bootstrap -- <用户名>@users.jobtrace.local
```

用户名为 3–30 位字母、数字或下划线，不区分大小写；密码长度为 8–16 位。公开注册不接受角色参数。

### 后台边界

- `/admin`：运营摘要。
- `/admin/users`：最小账号目录、只读投递/面经档案和具名访问变更。
- `/admin/audit`：只读管理审计。

账号提升、降级、禁用和启用要求 10–500 字原因、目标访问版本与稳定 request ID。禁用会立即撤销全部 Session；重新启用不会恢复旧 Session。系统保护最后一个有效管理员，自我降级或自我禁用还要求强化确认。

后台不提供业务数据编辑、删除或导出。用户删除后，审计继续保留身份快照和前后状态。

## 生产构建与部署

JobTrace 需要 Node.js 服务器、PostgreSQL 和持久化运行时，不能作为纯静态站点部署。

### 标准 Node.js 运行

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

默认监听端口由 Next.js 决定，可通过 `PORT` 和 `HOSTNAME` 配置。反向代理应终止 TLS、转发原始 `Host`/`Origin` 语义并对上传体积设置至少 5 MB 的允许值。

### Standalone 运行

`next.config.ts` 启用了 `output: "standalone"`。构建后需把静态资源放入 standalone 目录，再启动最小服务器：

```bash
pnpm build
cp -R .next/static .next/standalone/.next/static
HOSTNAME=0.0.0.0 PORT=3000 node .next/standalone/server.js
```

当前仓库没有 `public/` 目录；未来若新增该目录，也需要复制到 `.next/standalone/public`。构建产物不应内置生产密钥，运行时注入服务端环境变量。

### 发布顺序

1. 创建并验证数据库备份。
2. 在空库运行迁移重放，并完成类型漂移和数据库烟雾校验。
3. 构建新应用并完成质量门禁。
4. 对预发布或生产数据库执行 `pnpm db`。
5. 发布应用，检查 `GET /api/health/live`、`GET /api/health/ready`、登录、首页读取和一次非破坏性查询。
6. 观察错误率、数据库连接数和关键延迟，再结束维护窗口。

迁移采用先扩展后收缩。应用回滚时切换到上一构建，保留已写入的数据和新字段；不要通过删除审计或逆向执行破坏性 SQL 回滚。

## 健康检查与监控

探针分为三类：

- `GET /api/health/live` 只验证 Node.js 进程可响应，供存活检查使用。
- `GET /api/health/ready` 验证数据库连接和关键表结构，供流量切换前的就绪检查使用；响应带数据库 `Server-Timing`。
- `GET /api/health` 保留兼容行为，执行核心投递表查询。

兼容健康检查返回：

- `200 {"status":"ok"}`：应用能够访问已迁移数据库。
- `503 {"status":"error"}`：配置、网络、权限、连接数或迁移状态异常。

该检查不验证 COS、CAPTCHA 或完整业务流程。部署平台可把它作为就绪检查，但仍需分别监控：

- HTTP 5xx、`problemResponse` 错误代码和 `x-request-id`；
- PostgreSQL 连接数、慢查询、存储空间和备份状态；
- 登录/注册拒绝率与限流命中；
- 首页、面经保存和管理后台的 p95 延迟；
- COS 上传失败率（启用头像时）。

日志不得包含 Cookie、Session、密码、token、投递备注、面经正文、管理原因、邮箱、IP 或 user-agent。

## 性能与发布门禁

完整发布检查建议依次运行：

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

数据库性能基准覆盖投递、每用户 10,000 篇面经，以及 10,000 用户与 100,000 条管理审计。仓库门禁要求相应读取 p95 不超过 2 秒、写入 p95 不超过 1 秒；更细的范围见[测试指南](testing.md)。

## 常见故障

### `DATABASE_URL is required`

确认仓库根目录存在 `.env.local`，变量名称正确，且命令从仓库根目录运行。Python 数据库脚本只读取进程环境和根目录 `.env.local`。

### 无法创建临时数据库

`db:reset:verify`、`contract`、`integration`、`e2e` 和 `performance` 需要连接 `postgres` 维护库并执行 `CREATE DATABASE` / `DROP DATABASE`。为本地或 CI 使用具备该权限的测试账号，不要因此扩大生产应用账号权限。

### 迁移漂移

不要覆盖已执行 SQL。恢复原迁移内容，另建后续迁移；若只是生成类型不同步，先确认真实数据库结构，再运行 `pnpm db:types`。

### 登录循环或 CSRF 拒绝

核对 `BETTER_AUTH_URL` 的协议、主机和端口是否与浏览器访问地址一致。生产环境确认反向代理转发来源信息且只使用 HTTPS。

### 头像上传失败

核对 COS 地域、带 APPID 的桶名、凭据权限、公开读取策略与自定义域名。不要在日志中打印签名、密钥或完整请求头。

### 健康检查返回 503

先检查 `DATABASE_URL`、网络和数据库连接数，再确认迁移已执行且 `public.applications` 存在。使用应用日志中的健康检查结果和请求附近的数据库错误定位，不要把敏感连接串复制到工单。

## 相关文档

- [README 与快速开始](../README.md)
- [架构与安全边界](architecture.md)
- [数据导入与导出](data-transfer.md)
- [测试策略与命令](testing.md)

## 自动招聘同步运维

### 本地代理与 Fake-IP DNS

Greenhouse、Lever、Ashby、SmartRecruiters、飞书招聘、Moka、小米招聘以及字节跳动、华为、网易、米哈游官网的已审核官方公共 API 主机默认兼容 Clash 等代理的 `198.18.0.0/15` Fake-IP DNS。其他来源只有在开发环境或显式设置 `JOB_MARKET_ALLOW_PROXY_DNS=true` 时才启用兼容。所有情况仍要求精确 HTTPS 主机白名单；回环、RFC1918、链路本地和云元数据地址继续被拒绝。生产环境若需为自定义来源启用 Fake-IP，应先确认出站代理边界。

### 默认目录一键初始化

管理员可以打开 `/admin/job-market` 并点击“一键初始化并首次同步”。当前受审查的自动目录包含 245 家企业、247 个来源（188 个中国来源、59 个在中国大陆招聘的外企来源；华为与米哈游按校招/社招拆分为两个来源），已于 2026-09-03 复核公开入口。中国企业优先使用飞书招聘、Moka 或企业官网公开招聘接口，覆盖民营企业、国企和上市公司；腾讯、百度、京东、字节跳动、华为（`apigw-dgg-b0.huawei.com` 网关，校招 `jobType=CR`、社招 `jobType=SR`）、网易（`hr.163.com`，社招全量）和米哈游（`ats.openout.mihoyo.com`，社招 `hireType=0`、校招 `hireType=1`）走 `china_bigtech` 适配器的官方公开接口；SmartRecruiters 来源使用 `country=cn`，Greenhouse 与 Lever 在规范化前按中国大陆地点过滤；小米官网接口同时返回全球岗位，因此适配器也会按中国大陆城市白名单过滤。每家公司每次最多保留最新 100 个返回岗位，超出时运行状态为 `partial`。该操作会：

1. 使用稳定的 `default:*` 标识幂等创建或更新企业；
2. 将缺失来源创建为启用状态，不重复创建已有记录；
3. 保留管理员已经设置的 `paused` 或 `revoked` 状态；
4. 自动撤销不再属于当前 `default:*` 目录的旧来源，使其历史海外岗位不再出现在首页；
5. 每批最多同步 3 个活动来源，并报告成功、部分成功、失败和跳过数量。

默认目录由源码管理，因为每个条目都会扩大服务端出站访问白名单。增加企业前必须人工验证其公开 ATS 接口；自动化测试仍只能访问本地 fixture，不能依赖真实企业站点。

一键初始化可以在定时同步关闭时完成首次同步。后续持续更新仍需设置 `JOB_MARKET_ENABLED=true`、有效的 `JOB_MARKET_SYNC_SECRET`，并配置下述调度器。

外部调度器每六小时调用一次 `POST /api/internal/job-market/sync`。默认企业来源的同步间隔同样是六小时；每次计划任务以 10 个来源为一批持续认领，队列清空时提前结束，最多执行 30 批、覆盖 300 个到期来源。这为继续扩展更多公司预留了容量，同时避免空跑。生产环境必须设置 `JOB_MARKET_ENABLED=true`，并由秘密管理系统注入 `JOB_MARKET_SYNC_SECRET`；轮换时先在调用方和应用同时支持新值，再移除旧值，任何日志和 cron 命令都不得打印密钥。`JOB_MARKET_SYNC_BATCH_SIZE` 控制单次认领数，HTTP 超时和响应体上限由对应环境变量限定；来源自身的同步间隔用于计算下次到期时间。

仓库提供 `.github/workflows/job-market-sync.yml`，默认每六小时触发一次，也支持在 Actions 页面手动运行。启用步骤：

1. 在生产应用设置 `JOB_MARKET_ENABLED=true` 和一个至少 32 字符的 `JOB_MARKET_SYNC_SECRET`，重新部署；
2. 在 GitHub 仓库 Actions Variables 新建 `JOB_MARKET_SYNC_URL`，值为生产站点来源，例如 `https://jobtrace.example.com`；
3. 在 Actions Secrets 新建同名 `JOB_MARKET_SYNC_SECRET`，值必须与生产应用一致；
4. 手动运行一次 **Job market sync**，确认返回的 `failed` 为 `0`，之后由计划任务持续认领到期来源。

这条链路不依赖飞书表格：已登记的 Greenhouse、Lever、Ashby、SmartRecruiters、飞书招聘、Moka、小米及 Schema.org 官方来源会自动发现岗位，规范化公司、岗位和地点，并关闭来源中已经下架的旧岗位。Moka 发现器兼容 `social-recruitment`、`campus-recruitment`、`apply`、`campus_apply` 及其移动端入口。飞书目录只承担企业入口发现和人工审核，不是运行时岗位数据源。

公众号文章不纳入自动抓取。公众号没有稳定的公开岗位 API，页面访问还受登录、频率和反自动化限制；对仅通过公众号发布的企业，首页保留经审核的招聘原文链接，并以原文内容为准。新增自动企业时，应优先接入其官方 ATS/API 或官网 `JobPosting` 结构化数据。

### 已评估但暂不接入的渠道（2026-09-03 实测）

以下头部公司渠道已实测评估，因反爬或登录态限制暂不接入，避免重复调研：

| 公司 | 评估结论 |
| --- | --- |
| 哔哩哔哩（jobs.bilibili.com） | 全部 API 端点要求前端风控 SDK 生成的 `ajSessionId` 会话参数，伪造值被拒绝 |
| 美团（zhaopin.meituan.com） | 职位 API 返回 401 未登录；页面纯 SPA 无 SSR 职位链接，`html_list` 兜底也不可行 |
| 阿里巴巴（talent-holding.alibaba.com） | 接口 403 并接入 baxia 风控（滑块），目录仅保留官网入口链接 |
| 中国广核（cgn.hotjob.cn） | 大易站点为 SPA 且接口带 crypto-js 加密签名，无法静态抓取 |
| 字节跳动校招（portal_type 区分） | 校招列表请求需页面 JS 生成的 `_signature` 签名参数，仅社招通道可直连 |
| 快手（zhaopin.kuaishou.cn） | 职位 API 要求页面 JS 生成的 `sign` + `signTimestamp` 签名头（2026-09-03 实测，开源项目记载的旧端点已 404） |
| 拼多多（careers.pinduoduo.com） | 职位 API 返回 403 风控拦截 |
| 携程（careers.ctrip.com） | SPA 交互链路复杂，列表 API 未在公开请求中暴露，直连探测失败 |
| DeepSeek（talent.deepseek.com） | 官网壳跳转 Moka 新版门户（`app.mokahr.com` 的 high-flyer 租户），其 `ats-apply` API 响应为加密密文，需页面 JS 解密 |
| vivo / OPPO / 滴滴 / 小红书 / 蚂蚁 | vivo 要登录 token、OPPO 接口 500、滴滴旧端点 404、小红书与蚂蚁为纯 SPA，开源项目记载的端点均已失效 |

### 来源发现与人工审核

管理员可在 `/admin/job-market` 的“招聘入口扫描与审核”区域分批检查目录中的公开招聘官网。扫描器只请求已登记的 HTTPS 入口，并复用精确主机、公共 DNS、重定向、超时、内容类型和响应大小限制；它只识别经过代码审查的 ATS URL 模式、页面公开链接或 `JobPosting` JSON-LD，不执行页面脚本，也不扫描公众号正文。

扫描产生的记录默认是“待审核”或“未识别”，不会参与计划同步。管理员核对企业、官方入口、识别类型和精确主机后点击“批准并启用”，系统才在同一事务中创建活动来源；访问失败、未识别或已忽略的记录不能批准。新增适配器或扩大识别域名仍需代码审查和固定 fixture，不得把任意 URL 变成通用爬虫。

来源上线顺序为：确认公开或书面授权依据、登记精确 HTTPS 入口与主机、默认暂停、用 fixture/预发布验证、启用少量来源、观察运行计数后扩容。429 遵循 `Retry-After`，其他失败指数退避；暂停或撤销会释放租约且不再被计划任务认领。管理员只能看到安全错误码和摘要，原始响应、联系人、凭据和带 userinfo 的 URL 不保留在日志中。

告警至少覆盖连续失败、12 小时未成功、租约超过预期仍未释放、单次发现/关闭数量突变和调度端 401。运行记录和事件为审计数据；按组织保留策略定期归档，不应在故障处理中直接删除。回滚时先停止调度，再设置 `JOB_MARKET_ENABLED=false` 并暂停来源；保留新增表和私人投递快照，`/applications`、分析与面经不受影响。

本机验收说明：2026-08-30 已使用隔离临时数据库完成契约与集成场景。配置的远程 PostgreSQL 未安装 pgTAP，因此本机 `db:sql:test` 只能在安装扩展的 CI PostgreSQL 17 服务执行；这不影响迁移、Python 数据库校验或 TypeScript 类型生成。Quickstart 中原先的 `format:check`、`test:coverage`、`test:e2e` 名称与仓库脚本不同，实际分别使用 `pnpm format`、`pnpm test`、`pnpm e2e`。
