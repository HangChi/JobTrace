# JobTrace 职迹

面向个人用户的求职投递管理 Web 应用，支持投递记录、状态和阶段历史、列表检索、统计跟进以及 CSV/XLSX 导入导出。

## 快速开始

要求 Node.js 24、pnpm、Python 3.12 和 uv。

```bash
pnpm install
cp .env.example .env.local
pnpm db
pnpm dev
```

打开 `http://127.0.0.1:3000`。把 PostgreSQL 连接串写入本机 `.env.local` 的 `DATABASE_URL`；该文件已被 Git 忽略，不得提交或暴露给浏览器。

## 质量命令

```bash
pnpm format
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm e2e
pnpm performance
```

架构与模块边界见 `docs/architecture.md`，部署、迁移和回滚见 `docs/operations.md`。
