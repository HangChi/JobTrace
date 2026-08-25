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

| 变量                         | 生产要求                                                                                                                      |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`               | 指向 PostgreSQL 17；启用 TLS 时按数据库供应商要求加入连接参数。应用进程每实例最多建立 10 个业务连接，Better Auth 另有连接池。 |
| `BETTER_AUTH_SECRET`         | 至少 32 个字符，使用密码学安全随机值，通过密钥管理服务注入。轮换会影响现有认证状态，应在维护窗口执行。                        |
| `BETTER_AUTH_URL`            | 与用户实际访问的规范来源完全一致，生产环境使用 HTTPS；同源写请求会据此校验 `Origin`。                                         |
| `AUTH_CHALLENGE_VERIFY_URL`  | 可选。配置后，登录和注册必须提供 `x-auth-challenge`，服务端以 JSON 调用该端点。                                               |
| `AUTH_CHALLENGE_SECRET`      | 按 CAPTCHA 服务要求设置，不得暴露给浏览器。                                                                                   |
| `AUTH_EMAIL_DELIVERY_URL`    | 可选。接收 `{to, template, resetUrl, expiresInSeconds}` 的服务端 Webhook；生产密码恢复必须配置。                              |
| `AUTH_EMAIL_DELIVERY_SECRET` | 可选。作为 Bearer 凭据调用邮件投递 Webhook，不得暴露给浏览器。                                                                |

> [!WARNING]
> `DATABASE_URL`、`BETTER_AUTH_SECRET`、`AUTH_CHALLENGE_SECRET` 和所有 COS 凭据都只能作为服务端变量存在，不得添加 `NEXT_PUBLIC_` 前缀。

登录、注册和密码恢复共享 PostgreSQL 限流状态，可在多实例部署中保持一致。反向代理必须覆盖而不是透传客户端伪造的 `X-Forwarded-For` / `X-Real-IP`，也可以在可信网关叠加更严格的限流。

### 头像存储

头像通过服务端签名请求上传到腾讯云 COS。需要配置：

- `COS_SECRET_ID` 与 `COS_SECRET_KEY`
- `COS_BUCKET`，包含 APPID 后缀
- `COS_REGION`，例如 `ap-shanghai`
- 可选 `COS_PUBLIC_BASE_URL`

使用仅允许目标桶或 `avatars/` 前缀对象上传的子账号凭据，不要使用主账号永久密钥。头像 URL 需要公开读取，因此应为目标前缀配置只读访问策略。未配置 COS 时，除头像上传外的功能仍可使用。

### 密码恢复与会话

注册或个人资料页可设置恢复邮箱。忘记密码入口始终返回不枚举账号的统一提示；存在账号时，Better Auth 生成一小时有效的单次 token，并通过邮件投递 Webhook 发送重置链接。没有配置 Webhook 时不要在生产环境承诺自助恢复能力。

个人中心可查看所有未过期会话并逐个撤销；修改密码会撤销其他设备的会话。恢复邮箱、重置 URL、投递凭据和 Session 都不得写入日志。

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
