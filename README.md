# JobTrace 职迹

面向个人用户的求职投递管理 Web 应用，支持投递记录、状态和阶段历史、列表检索、统计跟进以及 CSV/XLSX 导入导出。

## 账号与角色配置

JobTrace 使用自有 PostgreSQL 和 Better Auth 提供用户名密码认证。用户名为 3–30 位字母、数字或下划线，注册密码至少 8 位；用户、密码哈希、Session、验证令牌、角色和业务数据都保存在 `DATABASE_URL` 指向的数据库，公开注册固定创建普通用户。运行前配置 `.env.example` 中的 `DATABASE_URL`、`BETTER_AUTH_SECRET` 与 `BETTER_AUTH_URL`。

首次管理员需先通过注册页创建账号，再使用该账号在数据库中的内部邮箱执行 `pnpm admin:bootstrap -- <内部邮箱>`；用户名 `alice` 对应的内部邮箱是 `alice@users.jobtrace.local`。从旧单用户版本升级时，先注册目标用户，再显式把遗留投递与导入批次的 `owner_id` 设为该用户 ID；不得自动归给首个注册者。应用迁移前请备份数据库，回滚时不得删除用户、Session、审计表或业务表的 `owner_id`。

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
