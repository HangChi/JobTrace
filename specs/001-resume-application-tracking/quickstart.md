# Quickstart & Validation: 职迹

## 2026-08-13 实现验证记录

- 远程 PostgreSQL `jobtrace` 已应用 4 个迁移，迁移器复跑均为 `SKIP` 且校验和无漂移。
- 数据库事务验证 6/6 通过：原子创建事件、阶段聚合、乐观锁、RLS 与统计。
- 核心 HTTP API 集成旅程 9/9 通过；阶段新增/移除旅程 4/4 通过；测试记录均已清理。
- 单元测试 10/10、ESLint、TypeScript strict 和 Next.js 生产构建通过。
- 覆盖率、完整 E2E、无障碍和性能门禁尚未通过，详见 `validation-report.md`。

### 最终门禁更新

- 单元/组件 19/19；行覆盖率 91.18%，分支覆盖率 80.95%。
- 契约 4/4；数据库/API 集成 5/5；E2E/axe 7/7。
- 10,000 条回滚性能基准：列表 24.28ms、筛选 25.20ms、统计 27.32ms（p95）。
- 5 个迁移无漂移；随机临时空库完成迁移与 seed 重放并已删除。
- Next.js 生产构建通过；Lighthouse 桌面视口连续 3 次实测通过，LCP 2046–2105ms、CLS 0.0109、性能分 89–90。

本指南用于在实现完成后验证技术方案和四条核心用户旅程。它不是实现脚本；具体命令名可在项目初始化时保持相同语义。

## Prerequisites

- Node.js 24 LTS 与项目选定的包管理器
- Python 3.12 与 uv（数据库迁移和验证脚本）
- 可访问的 PostgreSQL 17 实例
- 支持的桌面浏览器

## 1. Configure

认证与迁移使用 `.env.example` 中的 `DATABASE_URL`、`BETTER_AUTH_SECRET` 与 `BETTER_AUTH_URL`。认证密钥至少 32 个随机字符，只能存在于服务端环境；旧数据必须显式选择已注册用户作为 owner，不得使用“第一个注册用户”作为隐式归属。

```bash
cp .env.example .env.local
pnpm install
pnpm db
pnpm db:types
```

不得使用 `NEXT_PUBLIC_` 前缀暴露数据库连接或认证密钥。数据库结构应完全来自 `supabase/migrations/`，类型输出到 `src/generated/database.types.ts`。

验证：

```bash
pnpm db:test
pnpm typecheck
```

预期：迁移从空数据库成功重放；数据库测试通过；生成类型与已提交文件无差异。

## 2. Run Quality Gates

2026-08-14 独立验收结果：Vitest 47/47、契约 8/8、真实数据库集成 10/10、
Chromium E2E/axe 15/15 均通过。测试套件通过 `run_with_temp_database.py`
创建并销毁隔离数据库，不写入开发数据库；owner 迁移演练和空库重放均通过。
认证恢复当前按“SMTP 未配置”的受控回退验收，不声明邮件交付能力。

```bash
pnpm format
pnpm lint
pnpm typecheck
pnpm test
pnpm integration
pnpm contract
```

预期：所有检查通过，变更代码的行覆盖率和分支覆盖率均不低于 80%；HTTP 行为符合 [OpenAPI 契约](./contracts/openapi.yaml)。

## 3. Start the Application

```bash
pnpm dev
```

打开终端输出的本地地址。首屏应显示统计区、跟进区和投递列表的空状态，并提供“新增投递”和“导入数据”入口。键盘 Tab 顺序合理且所有交互控件有可见焦点。

## 4. Validate Primary Journeys

### Journey 0 — Authentication and role routing

1. 注册用户名 `user_a` 和至少 8 位密码，确认公开表单无法提交/决定 `admin` 角色。
2. 以普通用户登录；预期进入 `/`。
3. 以预置管理员登录；预期进入 `/admin`，可分页查看用户但不能禁用最后一个管理员。
4. 普通用户直接访问 `/admin`：页面不得显示管理数据；管理 API 返回 `403`。
5. 未登录访问 `/applications/new` 与 `/api/applications`：页面跳转登录，API 返回 `401`。
6. 退出后重试受保护资源；预期会话失效。密码恢复尚未配置邮件投递时应返回统一说明，不泄露账号是否存在。

### Journey 0B — Tenant isolation

1. 用户 A、B 分别创建两组唯一公司名记录，并各自执行列表、详情、统计、导入与导出。
2. 用户 A 使用用户 B 的 application/batch UUID 请求 GET/PATCH/DELETE/confirm。
3. 预期所有跨 owner 请求返回 `404` 或统一拒绝，不泄露资源存在性；A/B 统计和导出均无混入。
4. 管理员只通过 `/admin` 专用只读用例查看全局摘要；普通业务首页仍仅展示管理员本人的数据。

### Journey A — Create and maintain an application

1. 仅填写公司、岗位和今天以前的投递日期并保存。
2. 确认列表出现记录，最新日期等于投递日期。
3. 保持状态为已投递，添加一面和二面，并填写不同发生日期；再将状态改为 Offer 或拒绝。
4. 确认详情历史按日期展示状态和阶段变化，列表阶段不重复。
5. 在另一个浏览器标签修改记录，再从旧标签保存，确认收到冲突提示且新数据未被覆盖。
6. 尝试无效 URL、未来日期和空白公司名，确认字段错误且输入保留。

### Journey B — Search, filter and delete

1. 使用 seed 创建不同状态、城市和阶段的数据。
2. 组合公司/岗位关键词、状态、阶段、城市和日期范围。
3. 确认 URL 保存条件，刷新后结果不变；清除条件恢复默认活跃优先分组。
4. 切换四种排序字段和方向，确认跨页结果稳定且无重复/遗漏。
5. 打开记录并发起删除；先取消并确认记录保留，再确认删除并返回原筛选列表。

### Journey C — Analytics and follow-up

1. 执行固定统计 fixture，覆盖已投递、Offer、拒绝、全部阶段、本周边界和 15 天阈值。
2. 核对总数、已投递、拒绝、Offer、本周新增和阶段分布。
3. 确认已投递且投递内容或招聘时间线恰好停滞 15 天的记录出现提醒，停滞 14 天的不出现；Offer 和拒绝不提醒。
4. 更新提醒记录或将其转为 Offer/拒绝，确认提醒立即消失。

### Journey D — Import and export

1. 上传 fixtures 中混合有效、无效和重复候选的 CSV 与 XLSX（均低于限制）。
2. 确认预检不写入投递，逐行错误可理解，重复候选不被静默覆盖。
3. 为重复项分别选择跳过/创建副本并确认，核对 created/skipped/failed 汇总。
4. 导出全部记录，再导出当前筛选结果为 XLSX/CSV，核对行数、中文标签和全部业务字段。
5. 上传超过 5MB、超过 10,000 行及损坏文件，确认无记录创建且错误可恢复。

## 5. Accessibility and End-to-End

```bash
npm run test:e2e
npm run test:a11y
```

预期：仅键盘可完成四条 Journey；表单错误、对话框、加载/空/成功/失败状态可由辅助技术识别；自动检查无 WCAG 2.2 AA 严重违规。人工确认对话框焦点回归、状态不只依赖颜色、表格在较窄桌面窗口仍可操作。

## 6. Performance Validation

```bash
npm run seed:performance -- --applications=10000
npm run test:performance
npm run test:web-vitals
```

在固定硬件/容器配额和清晰记录的构建模式下运行至少三轮，预热后统计：

- 搜索、组合筛选、排序、统计和 CRUD 反馈 p95 ≤ 1 秒；
- LCP p75 ≤ 2.5 秒；
- INP p75 ≤ 200 毫秒；
- CLS ≤ 0.1；
- 分页遍历无重复或遗漏。

任一预算失败即阻止发布；若环境噪声导致失败，应在相同条件重跑并保留测量输出，而不是放宽预算。

## 7. Release and Rollback Check

- 在旧数据副本上演练 owner 扩展→回填→非空/RLS 的迁移；缺少/无效 `MIGRATION_OWNER_ID` 时必须安全失败。
- 验证回滚旧应用构建不会删除 auth.users、profiles 或 owner 列；禁止回滚到可绕过认证并公开访问业务数据的版本。
- 验证角色变更、禁用和启用有管理员审计记录，且日志不含密码、token 或 Cookie。

```bash
npx supabase db reset
npm run build
npm run start
```

预期：全新数据库可重建、生产构建成功、健康检查通过。部署数据库迁移前审查 SQL 并保留数据库备份；应用部署保留上一构建以快速回滚。对破坏性 schema 变化采用“扩展 → 数据迁移 → 收缩”，不得让应用回滚依赖已被删除的列。

## Traceability

- 注册/登录/角色分流：FR-031–FR-034，SC-009–SC-010。
- 管理后台与账号安全：FR-035–FR-037，SC-010。
- owner/RLS 数据隔离：FR-026、FR-033，SC-011；详见 [data-model.md](./data-model.md)。

- 业务范围与验收：[spec.md](./spec.md)
- 架构和质量门禁：[plan.md](./plan.md)
- 数据约束与事务：[data-model.md](./data-model.md)
- HTTP/Server Action 等价契约：[contracts/openapi.yaml](./contracts/openapi.yaml)
