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
- 管理后台：`/admin` 提供运营摘要，`/admin/users` 提供最小账号目录、指定用户的只读投递/面经档案与具名访问变更，`/admin/audit` 提供只读审计。档案不提供编辑、删除或导出入口；对应接口全部动态读取并要求有效管理员。
- 活跃口径：按 `Asia/Shanghai` 自然日统计周期内至少创建一次有效登录 Session 的未禁用用户；同一用户多 Session 去重。未知分区显示“暂不可用”，不得按 0 展示。
- 账号事件：四种具名动作要求 10–500 字原因、`accessVersion` 和稳定 `requestId`。禁用在同一事务撤销全部 Session，重新启用不恢复旧 Session；数据库保护最后一个有效管理员，自我降级/禁用还要求强化确认。
- 审计与监控：成功、拒绝和冲突都写入只追加审计。用户删除只清空当前外键，身份快照和前后状态继续保留。查看求职档案写 `admin.user_data_view` 安全日志，但只记录 actor/target ID、分页、记录数量和耗时。任何日志均禁止查询文本、原因、邮箱、Cookie、Session、IP、user-agent 和求职正文。
- 回滚：只回滚应用代码；保留 users、sessions、owner、`access_version`、访问函数及所有审计扩展字段/事件。管理写异常时关闭变更入口并保留只读审计，不得通过删除审计数据回滚。

## 数据库性能与测试数据

`pnpm performance` 通过临时数据库运行投递、面经和管理员后台基准；管理员样本包含 10,000 用户、分布式 Session/业务计数和 100,000 审计事件，读取 p95 门限 2 秒、写入 p95 门限 1 秒。结束后删除整个临时数据库。`pnpm performance:raw` 只用于连接当前 `DATABASE_URL` 排障；脚本会在单个事务中创建性能种子并在 `finally` 回滚，严禁在 raw 基准中调用 `commit()`。如果历史版本遗留 `interview-performance-owner` 数据，应先核对 owner、公司名前缀和精确数量，再在事务中删除，禁止按模糊名称清理真实记录。

性能排障先比较数据库端 `EXPLAIN (ANALYZE, BUFFERS)` 与端到端耗时。单条 SQL 很快但交互仍慢时，检查 Session 查询、写后详情读取、串行统计请求和 `router.refresh()` 引起的 Server Component 重跑。当前首页写入采用局部更新和后台对账，统计查询并行执行。

## 发布门禁

依次运行 `pnpm format`、`pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm db:reset:verify`、`pnpm db:types:check`、`pnpm db:test`、`pnpm contract`、`pnpm integration`、`pnpm e2e`、`pnpm performance`、`pnpm performance:auth`、`pnpm lighthouse` 和 `pnpm build`。契约、集成、E2E 与数据库性能脚本均创建隔离临时数据库并在结束后强制删除。

面经性能门禁会在事务内生成每用户 10,000 篇面经及对应问题、行动项，验证列表、组合筛选、问题搜索和聚合更新 p95 不超过 1 秒，随后回滚。面经内容属于敏感个人数据，诊断时不得打印请求正文；排障只记录 request ID、状态码、错误代码和耗时。

## 部署与回滚

数据库迁移应先通过 `pnpm db:reset:verify` 在空库重放，再对预发布备份执行 `pnpm db`。迁移器记录 SHA-256 校验和并拒绝已执行迁移漂移。应用发布保留上一构建；应用回滚时切换到上一构建。数据库变更采用先扩展后收缩，禁止直接回滚已写入业务数据的破坏性迁移。管理员与面经迁移均保留新增数据；若新版本异常，可先回滚应用并保留数据，修复后重新发布。CSV 导出是投递数据恢复路径，数据库备份是面经问题与行动项的恢复路径。
