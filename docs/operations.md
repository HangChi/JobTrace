# 运行与运维

## 本地环境

1. 安装 Node.js 24、pnpm、Python 3.12 和 uv。
2. 复制 `.env.example` 为 `.env.local`。
3. 在 `.env.local` 配置 `DATABASE_URL`，执行 `pnpm install`、`pnpm db`。
4. 执行 `pnpm dev`，访问 `http://127.0.0.1:3000`。

`DATABASE_URL` 只能存在于服务端环境变量中。首期没有账号体系，只允许部署到个人私有环境，不应公开为多用户服务。

## 发布门禁

依次运行 `pnpm format`、`pnpm lint`、`pnpm typecheck`、`pnpm test`、数据库测试、`pnpm e2e`、性能检查和 `pnpm build`。

## 部署与回滚

数据库迁移应先在临时数据库执行 `pnpm db` 验证。迁移器记录 SHA-256 校验和并拒绝已执行迁移漂移。应用发布保留上一构建；应用回滚时切换到上一构建。数据库变更采用先扩展后收缩，禁止直接回滚已写入业务数据的破坏性迁移。导出 CSV 是首期数据恢复路径。
