<div align="center">

<img src="src/app/icon.svg" width="96" height="96" alt="JobTrace 职迹标志" />

# JobTrace 职迹

**简洁、安全的个人求职投递管理工具**

集中记录投递、追踪招聘进展、统计跟进提醒，并支持数据导入导出。

</div>

## 简介

JobTrace 是一个面向个人求职者的多用户 Web 应用，用于替代分散的手工记录。它以一条条**投递记录**为核心，覆盖从投递、招聘阶段推进到 Offer / 拒绝的完整求职轨迹，并提供搜索筛选、统计分析、久未更新提醒以及 CSV/XLSX 导入导出。

- **多用户安全隔离**：每个用户只能访问自己的投递、统计、导入和导出数据，跨用户数据混入率为 0%。
- **完整的求职轨迹**：状态、招聘阶段与备注的每次变化都会留下可回顾的历史记录。
- **可操作的跟进提醒**：自动标记连续 15 个完整日未更新的投递记录。
- **数据可迁移**：通用表格文件的批量预检导入，以及全部或筛选结果的导出。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 框架 | [Next.js](https://nextjs.org/) 16（App Router）、React 19、TypeScript |
| 数据库 | PostgreSQL 17（仅服务端驱动，SQL 迁移 + 原子写函数） |
| 认证 | [Better Auth](https://www.better-auth.com/) 用户名密码模式 + 角色访问 |
| 数据导入导出 | CSV / XLSX |
| 测试 | Vitest、Playwright、@axe-core/playwright、Lighthouse CI |

## 快速开始

> [!NOTE]
> 要求 Node.js 24、pnpm、Python 3.12 和 uv。

```bash
pnpm install
cp .env.example .env.local
pnpm db
pnpm dev
```

打开 <http://127.0.0.1:3000>。首次使用需先在注册页创建一个普通用户，再以该用户的内部邮箱引导管理员（见下方「账号与角色」）。

> [!WARNING]
> 把 PostgreSQL 连接串写入本机 `.env.local` 的 `DATABASE_URL`；该文件已被 Git 忽略，不得提交或暴露给浏览器。

## 账号与角色

JobTrace 使用自有 PostgreSQL 和 Better Auth 提供用户名密码认证。用户名、密码哈希、Session、验证令牌、角色和业务数据都保存在 `DATABASE_URL` 指向的数据库，公开注册固定创建普通用户。

- **用户名**：3–30 位字母、数字或下划线，不区分大小写；**密码**至少 8 位。
- **首个管理员**：先通过注册页创建账号，再以 `<用户名>@users.jobtrace.local` 执行引导命令：

  ```bash
  pnpm admin:bootstrap -- <内部邮箱>
  ```

- **旧单用户升级**：先注册目标用户，再显式把遗留投递与导入批次的 `owner_id` 设为该用户 ID，不得自动归给首个注册者。可先用 `pnpm db:owner:test` 在临时数据库演练，确认回填数量后运行 `pnpm db:owner:migrate`。

## 项目结构

采用模块化单体，依赖方向为 `app → application → domain`，模块间只通过各自的 `index.ts` 公开接口协作。

```
src/
├── app/              页面、Server Components 与 HTTP Route Handlers
├── modules/
│   ├── applications/ 投递聚合、查询、仓储与界面
│   ├── analytics/    只读统计与跟进提醒
│   ├── data-transfer/ CSV/XLSX 预检和导出
│   └── identity-access/ 认证、角色与后台管理
└── shared/           日期、游标、错误、日志、数据库客户端和 UI 原语
supabase/migrations/  SQL 迁移（沿用规格目录）
specs/                需求规格、数据模型、OpenAPI 契约
docs/                 架构与运维文档
```

## 常用命令

### 质量门禁

```bash
pnpm format      # Prettier 格式检查
pnpm lint        # ESLint
pnpm typecheck   # TypeScript 类型检查
pnpm test        # 单元测试（含覆盖率）
pnpm build       # 生产构建
```

### 数据库

```bash
pnpm db                 # 应用迁移
pnpm db:test            # 校验迁移结果
pnpm db:types           # 从数据库生成类型
pnpm db:types:check     # 检查数据库类型是否漂移
pnpm admin:bootstrap    # 引导首个管理员
pnpm db:owner:migrate   # 回填旧数据 owner
pnpm db:owner:test      # 在临时库演练 owner 回填
```

### 测试与性能

```bash
pnpm contract       # 契约测试
pnpm integration    # 集成测试
pnpm e2e            # 端到端测试
pnpm performance    # 性能检查
pnpm lighthouse     # Lighthouse CI
```

所有需要数据库的测试均通过 `run_with_temp_database.py` 在临时数据库上运行，不影响本地数据。

## 环境变量

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `DATABASE_URL` | 是 | PostgreSQL 连接串 |
| `BETTER_AUTH_SECRET` | 是 | 认证密钥，生产环境至少 32 字节 |
| `BETTER_AUTH_URL` | 是 | 应用访问地址 |
| `AUTH_CHALLENGE_VERIFY_URL` | 否 | CAPTCHA 兼容的验证端点 |
| `AUTH_CHALLENGE_SECRET` | 否 | CAPTCHA 验证密钥 |

完整说明见 [.env.example](.env.example)。

## 文档

- 架构与模块边界：[docs/architecture.md](docs/architecture.md)
- 部署、迁移与回滚：[docs/operations.md](docs/operations.md)
- 需求规格：[specs/001-resume-application-tracking/spec.md](specs/001-resume-application-tracking/spec.md)
