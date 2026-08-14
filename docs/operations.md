# 运行与运维

## 本地环境

1. 安装 Node.js 24、pnpm、Python 3.12 和 uv。
2. 复制 `.env.example` 为 `.env.local`。
3. 在 `.env.local` 配置 `DATABASE_URL`，执行 `pnpm install`、`pnpm db`。
4. 执行 `pnpm dev`，访问 `http://127.0.0.1:3000`。

`DATABASE_URL` 与 `BETTER_AUTH_SECRET` 只能存在于服务端环境变量中。所有最终授权由服务端 actor 校验和数据库查询中的 `owner_id` 条件执行。

## 认证运维

- 首个管理员：先公开注册用户名，再以 `<用户名>@users.jobtrace.local` 执行 `pnpm admin:bootstrap -- <内部邮箱>`；公开注册永远不接收角色。
- 旧数据：显式选择已注册用户 ID，人工确认后回填 `applications.owner_id` 与 `import_batches.owner_id`；不要按注册顺序推断 owner。
- 账号事件：管理员可在 `/admin` 禁用账号并撤销全局会话；数据库阻止禁用或降级最后一个有效管理员。
- 回滚：仅回滚应用代码，并确认旧构建无法绕过登录；保留 users、sessions、owner 列及审计事件。

## 发布门禁

依次运行 `pnpm format`、`pnpm lint`、`pnpm typecheck`、`pnpm test`、数据库测试、`pnpm e2e`、性能检查和 `pnpm build`。

## 部署与回滚

数据库迁移应先在临时数据库执行 `pnpm db` 验证。迁移器记录 SHA-256 校验和并拒绝已执行迁移漂移。应用发布保留上一构建；应用回滚时切换到上一构建。数据库变更采用先扩展后收缩，禁止直接回滚已写入业务数据的破坏性迁移。导出 CSV 是首期数据恢复路径。
