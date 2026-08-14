# 实现验证报告

**日期**：2026-08-14
**环境**：Windows，Next.js 16.3.0，PostgreSQL，Playwright Chromium

## 结论

当前代码与 Better Auth 用户名密码认证、自托管 PostgreSQL、显式 actor/owner
授权模型一致。所有自动化发布门禁通过；数据库、契约、集成、E2E 与性能测试均在
自动销毁的隔离临时数据库中运行，未迁移或修改现有开发数据库。

## 门禁证据

- 规格清单：`requirements.md` 16/16。
- owner 迁移：缺失/无效 `MIGRATION_OWNER_ID` 安全失败，遗留 application/import
  batch 成功回填，最终 `owner_id NOT NULL`；空库全部迁移与 seed 重放通过。
- 数据库类型：从干净临时库生成，包含 Better Auth users/sessions/accounts、owner
  和审计表。
- 静态质量：Prettier、ESLint、TypeScript 通过。
- Vitest：19 个文件、47 项全部通过；行覆盖率 94.77%，分支覆盖率 89.88%。
- 真实数据库集成：10/10，包括双用户 CRUD、阶段、列表游标、统计、导入导出和
  最后管理员保护。
- HTTP 契约：8/8，包括未登录保护、跨 owner 404、管理员摘要 403、CSRF Problem。
- Chromium E2E/axe：15/15；覆盖认证、越权、应用生命周期、统计、导入、认证页、
  账号菜单、键盘焦点和 768px 窄桌面；axe 无违规。
- 性能：10,000 条/owner 数据下 list p95 27.33ms、filter p95 24.36ms、analytics
  p95 19.81ms；登录/角色分流 p95 ≤ 1s。
- Next.js 生产构建：通过，页面、API 和 Proxy 均生成成功。

## 发布操作

发布前先备份目标数据库，注册并人工确认遗留数据的目标用户，设置
`MIGRATION_OWNER_ID=<users.id>` 执行 `pnpm db:owner:migrate`，核对回填数量后再显式
执行 `pnpm db`。本报告没有代替操作者对目标数据库执行该有状态迁移。

SMTP 尚未配置：忘记密码入口返回统一说明、不枚举账号，密码重置保持 503。若要
宣称邮件密码恢复可用，需另行接入邮件传输并补充端到端交付测试。
