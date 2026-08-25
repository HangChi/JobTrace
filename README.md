<!-- prettier-ignore -->
<div align="center">

<img src="src/app/icon.svg" width="96" height="96" alt="JobTrace 职迹标志" />

# JobTrace 职迹

**简洁、安全的个人求职投递管理工具**

集中记录投递、招聘阶段与面试复盘，用可行动的提醒和数据分析持续推进求职。

[功能概览](#功能概览) · [快速开始](#快速开始) · [项目结构](#项目结构) · [开发与测试](#开发与测试) · [项目文档](#项目文档)

</div>

## 项目简介

JobTrace 是面向个人求职者的多用户 Web 应用。它以投递记录为主线，将岗位信息、招聘阶段、面试复盘、跟进提醒和周期分析集中在一个私密工作台中，并提供 CSV/XLSX 数据迁移能力。

> [!IMPORTANT]
> JobTrace 默认按 `Asia/Shanghai` 自然日处理业务日期。用户数据由服务端身份和每条数据库查询中的 `owner_id` 双重隔离；数据库连接串、认证密钥和 COS 密钥均不得暴露给浏览器。

## 功能概览

| 能力       | 说明                                                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 投递管理   | 记录公司、岗位、城市、投递类型、职位链接和备注；支持搜索、组合筛选、分页、批量删除与状态流转。                                        |
| 招聘时间线 | 记录简历筛选、测评、笔试及多轮面试；所有变更保留历史事件，并通过版本号防止并发覆盖。                                                  |
| 面试复盘   | 按具体阶段记录 Markdown 面经，支持即时预览、约 800ms 自动保存、筛选搜索和 Markdown/ZIP 导出。                                         |
| 提醒与分析 | 标记 15 个完整日未更新的投递，提醒补写已发生阶段的面经，并按周期分析趋势、转化、阶段到达率和维度表现。                                |
| 数据迁移   | CSV/XLSX 上传后逐行预检，重复候选由用户决定是否创建；投递可按全部、筛选结果或所选记录导出。                                           |
| 账号与后台 | 邮箱/用户名登录、注册邮箱验证码、邮箱换绑/解绑、个人资料和可选 COS 头像；管理员可查看运营摘要、只读用户档案并审阅不可修改的管理审计。 |

## 技术栈

| 层     | 技术                                                                     |
| ------ | ------------------------------------------------------------------------ |
| Web    | [Next.js](https://nextjs.org/) 16 App Router、React 19、TypeScript 5     |
| 数据库 | PostgreSQL 17、SQL 迁移、服务端 `postgres` 驱动                          |
| 认证   | [Better Auth](https://www.better-auth.com/) 用户名密码模式、角色访问控制 |
| 文件   | CSV/XLSX 导入导出、Markdown/ZIP 面经导出、可选腾讯云 COS 头像            |
| 质量   | Vitest、Playwright、axe-core、Lighthouse CI、ESLint、Prettier            |

## 快速开始

### 前置要求

- Node.js 24
- pnpm 10
- PostgreSQL 17，并准备一个当前账号可读写的空数据库
- Python 3.12 与 [uv](https://docs.astral.sh/uv/)（数据库脚本会通过 uv 安装固定版本的 `psycopg`）

### 本地运行

1. 安装依赖并创建本地配置：

   ```bash
   pnpm install
   cp .env.example .env.local
   ```

2. 编辑 `.env.local`，至少设置以下变量：

   ```dotenv
   DATABASE_URL=postgresql://username:password@127.0.0.1:5432/jobtrace
   BETTER_AUTH_SECRET=replace-with-at-least-32-random-characters
   BETTER_AUTH_URL=http://localhost:3000
   ```

3. 应用迁移并启动开发服务器：

   ```bash
   pnpm db
   pnpm dev
   ```

4. 打开 <http://localhost:3000/register> 创建账号。

> [!TIP]
> 可用 `openssl rand -base64 32` 生成本地认证密钥。修改环境变量后需要重启开发服务器。

> [!NOTE]
> 头像上传依赖腾讯云 COS；不使用头像时无需提供 COS 配置。密码恢复使用可选的邮件投递 Webhook；生产环境启用前需配置投递地址，并确认服务能够访问该地址。

### 引导管理员

公开注册固定创建普通用户。如需使用管理后台，先注册账号，再用其内部邮箱引导首个管理员：

```bash
pnpm admin:bootstrap -- <用户名>@users.jobtrace.local
```

管理员登录后可访问 `/admin`、`/admin/users` 和 `/admin/audit`。生产环境的认证、审计和回滚要求见[运行与运维](docs/operations.md)。

## 项目结构

JobTrace 采用模块化单体，主要依赖方向为 `app/UI → application → domain`，模块间通过各自的 `index.ts` 公开能力协作。

```text
src/
├── app/                 页面、Server Components 与 Route Handlers
├── modules/
│   ├── applications/    投递、招聘阶段与历史事件
│   ├── analytics/       首页摘要、提醒与周期分析
│   ├── data-transfer/   CSV/XLSX 导入和数据导出
│   ├── identity-access/ 认证、个人资料、角色与管理后台
│   └── interviews/      面经、问题、行动项与自动保存
└── shared/              日期、错误、日志、数据库与通用能力
supabase/migrations/     按顺序执行的 PostgreSQL 迁移
scripts/                 迁移、校验、管理员和旧数据工具
tests/                   集成、端到端、契约、无障碍与性能测试
specs/                   功能规格、计划、数据模型和 API 契约
docs/                    面向开发与运维的长期文档
```

更多边界、请求流和数据一致性说明见[架构文档](docs/architecture.md)。

## 开发与测试

### 日常质量检查

```bash
pnpm format      # Prettier 格式检查
pnpm lint        # ESLint 与模块边界规则
pnpm typecheck   # TypeScript 类型检查
pnpm test        # Vitest 单元测试与覆盖率
pnpm build       # Next.js 生产构建
```

### 数据库与端到端检查

```bash
pnpm db:reset:verify  # 从空库重放迁移并校验种子
pnpm db:types:check   # 检查生成的数据库类型是否漂移
pnpm db:test          # 数据库函数与约束烟雾校验
pnpm db:sql:test      # 运行 supabase/tests 中的 pgTAP SQL 断言
pnpm contract         # HTTP 契约测试
pnpm integration      # 集成测试
pnpm e2e              # Playwright 端到端与无障碍测试
pnpm performance      # 数据库性能门禁
pnpm performance:auth # 认证与管理后台性能门禁
pnpm lighthouse       # Web 性能与可访问性审计
```

除 `pnpm db:test` 外，上述契约、集成、E2E 和性能包装命令会创建隔离的临时数据库并在结束后删除。数据库账号需要具备 `CREATE DATABASE` 权限；命令范围和 `:raw` 变体的安全边界见[测试指南](docs/testing.md)。

## 环境变量

| 变量                                | 要求           | 用途                                                |
| ----------------------------------- | -------------- | --------------------------------------------------- |
| `DATABASE_URL`                      | 必填           | PostgreSQL 连接串，仅服务端使用。                   |
| `BETTER_AUTH_SECRET`                | 必填           | Better Auth 密钥，至少 32 个字符。                  |
| `BETTER_AUTH_URL`                   | 必填           | 应用的规范访问地址，生产环境必须为 HTTPS。          |
| `AUTH_CHALLENGE_VERIFY_URL`         | 可选           | CAPTCHA 兼容的服务端验证端点。                      |
| `AUTH_CHALLENGE_SECRET`             | 按验证服务要求 | 随验证请求传递的服务端密钥。                        |
| `AUTH_EMAIL_DELIVERY_URL`           | 生产注册必填   | 接收邮箱验证码和密码重置任务的服务端 Webhook。      |
| `AUTH_EMAIL_DELIVERY_SECRET`        | 可选           | Webhook 的 Bearer 凭据。                            |
| `AUTH_EMAIL_VERIFICATION_TEST_CODE` | 仅测试         | 非生产隔离测试使用的固定 6 位验证码。               |
| `COS_SECRET_ID` / `COS_SECRET_KEY`  | 头像上传必填   | 腾讯云 COS 最小权限凭据。                           |
| `COS_BUCKET` / `COS_REGION`         | 头像上传必填   | COS 存储桶和地域。                                  |
| `COS_PUBLIC_BASE_URL`               | 可选           | 头像公开访问域名；未设置时使用 COS 源站域名。       |
| `NEXT_DIST_DIR`                     | 可选           | 为并行测试覆盖 Next.js 构建目录；一般无需手动设置。 |

示例与注释见 [.env.example](.env.example)。

## 项目文档

- [架构与安全边界](docs/architecture.md)
- [运行、部署与故障处理](docs/operations.md)
- [数据导入与导出](docs/data-transfer.md)
- [测试策略与命令](docs/testing.md)
- [核心投递规格](specs/001-resume-application-tracking/spec.md)
- [面试复盘规格](specs/002-interview-review/spec.md)
- [求职分析规格](specs/003-job-search-analytics/spec.md)
- [管理后台规格](specs/004-enhance-admin-console/spec.md)
