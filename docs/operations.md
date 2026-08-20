# 运行与运维

## 本地环境

1. 安装 Node.js 24、pnpm、Python 3.12 和 uv。
2. 复制 `.env.example` 为 `.env.local`。
3. 在 `.env.local` 配置 `DATABASE_URL`，执行 `pnpm install`、`pnpm db`。
4. 执行 `pnpm dev`，访问 `http://127.0.0.1:3000`。

`DATABASE_URL` 与 `BETTER_AUTH_SECRET` 只能存在于服务端环境变量中。所有最终授权由服务端 actor 校验和数据库查询中的 `owner_id` 条件执行。

## 头像存储

头像通过服务端签名请求上传到腾讯云 COS。生产环境必须配置 `COS_SECRET_ID`、
`COS_SECRET_KEY`、`COS_BUCKET` 和 `COS_REGION`；自定义或加速域名通过
`COS_PUBLIC_BASE_URL` 配置。密钥仅授予目标桶的对象上传权限，不得使用主账号永久密钥，
也不得添加 `NEXT_PUBLIC_` 前缀。头像 URL 需要公开读取，因此目标桶或 `avatars/` 前缀应配置
只读访问策略。

## 认证运维

认证使用 Better Auth 的用户名密码模式。生产环境必须配置 HTTPS、至少 32 字节的
`BETTER_AUTH_SECRET` 和准确的 `BETTER_AUTH_URL`。如需 CAPTCHA，在服务端配置
`AUTH_CHALLENGE_VERIFY_URL` 与 `AUTH_CHALLENGE_SECRET`；登录和注册客户端通过
`x-auth-challenge` 传递供应商 token。SMTP 尚未接入，忘记密码页会给出不枚举账号的
统一提示，重置接口保持 503，需由管理员按应急流程处理。

- 首个管理员：先公开注册用户名，再以 `<用户名>@users.jobtrace.local` 执行 `pnpm admin:bootstrap -- <内部邮箱>`；公开注册永远不接收角色。
- 旧数据：备份后显式设置 `MIGRATION_OWNER_ID`，执行 `pnpm db:owner:migrate`；核对回填数量，再执行 `pnpm db` 强制 owner 外键与 NOT NULL。先运行 `pnpm db:owner:test` 可在临时库验证缺失、无效 owner 和成功回填；不要按注册顺序推断 owner。
- 账号事件：管理员可在 `/admin` 禁用账号并撤销全局会话；数据库阻止禁用或降级最后一个有效管理员。
- 回滚：仅回滚应用代码，并确认旧构建无法绕过登录；保留 users、sessions、owner 列及审计事件。若认证服务异常，先停止写入并切回上一应用构建，不得删除 owner 列或审计记录。

## 数据库性能与测试数据

`pnpm performance` 通过临时数据库运行投递和面经的 10,000 条规模基准，结束后删除整个临时数据库。`pnpm performance:raw` 只用于连接当前 `DATABASE_URL` 排障；脚本会在单个事务中创建性能种子并在 `finally` 回滚，严禁在 raw 基准中调用 `commit()`。如果历史版本遗留 `interview-performance-owner` 数据，应先核对 owner、公司名前缀和精确数量，再在事务中删除，禁止按模糊名称清理真实记录。

性能排障先比较数据库端 `EXPLAIN (ANALYZE, BUFFERS)` 与端到端耗时。单条 SQL 很快但交互仍慢时，检查 Session 查询、写后详情读取、串行统计请求和 `router.refresh()` 引起的 Server Component 重跑。当前首页写入采用局部更新和后台对账，统计查询并行执行。

## 发布门禁

依次运行 `pnpm format`、`pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm db:reset:verify`、`pnpm db:types:check`、`pnpm db:test`、`pnpm contract`、`pnpm integration`、`pnpm e2e`、`pnpm performance`、`pnpm performance:auth`、`pnpm lighthouse` 和 `pnpm build`。契约、集成、E2E 与数据库性能脚本均创建隔离临时数据库并在结束后强制删除。

面经性能门禁会在事务内生成每用户 10,000 篇面经及对应问题、行动项，验证列表、组合筛选、问题搜索和聚合更新 p95 不超过 1 秒，随后回滚。面经内容属于敏感个人数据，诊断时不得打印请求正文；排障只记录 request ID、状态码、错误代码和耗时。

## 部署与回滚

数据库迁移应先通过 `pnpm db:reset:verify` 在空库重放，再对预发布备份执行 `pnpm db`。迁移器记录 SHA-256 校验和并拒绝已执行迁移漂移。应用发布保留上一构建；应用回滚时切换到上一构建。数据库变更采用先扩展后收缩，禁止直接回滚已写入业务数据的破坏性迁移。面经表为扩展式迁移，旧构建不会读取；若新版本异常，可先回滚应用并保留面经数据，修复后重新发布。CSV 导出是投递数据恢复路径，数据库备份是面经问题与行动项的恢复路径。
