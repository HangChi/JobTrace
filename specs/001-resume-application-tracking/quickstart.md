# Quickstart & Validation: 职迹

本指南用于在实现完成后验证技术方案和四条核心用户旅程。它不是实现脚本；具体命令名可在项目初始化时保持相同语义。

## Prerequisites

- Node.js 24 LTS 与项目选定的包管理器
- Docker Desktop 或兼容容器运行时
- Supabase CLI（项目开发依赖）
- 支持的桌面浏览器

## 1. Configure

```bash
cp .env.example .env.local
npm install
npx supabase start
npx supabase db reset
npm run db:types
```

将 `supabase status` 输出的本地 URL 和仅服务端密钥填入 `.env.local`。不得使用 `NEXT_PUBLIC_` 前缀暴露服务端密钥。数据库结构应完全来自 `supabase/migrations/`，类型输出到 `src/generated/database.types.ts`。

验证：

```bash
npm run db:verify
npm run typecheck
```

预期：迁移从空数据库成功重放；数据库测试通过；生成类型与已提交文件无差异。

## 2. Run Quality Gates

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test:coverage
npm run test:integration
npm run test:contract
```

预期：所有检查通过，变更代码的行覆盖率和分支覆盖率均不低于 80%；HTTP 行为符合 [OpenAPI 契约](./contracts/openapi.yaml)。

## 3. Start the Application

```bash
npm run dev
```

打开终端输出的本地地址。首屏应显示统计区、跟进区和投递列表的空状态，并提供“新增投递”和“导入数据”入口。键盘 Tab 顺序合理且所有交互控件有可见焦点。

## 4. Validate Primary Journeys

### Journey A — Create and maintain an application

1. 仅填写公司、岗位和今天以前的投递日期并保存。
2. 确认列表出现记录，最新日期等于投递日期。
3. 在详情中将状态改为进行中，添加一面和二面，并填写不同发生日期。
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

1. 执行固定统计 fixture，覆盖全部状态、阶段、本周边界和 7 天阈值。
2. 核对总数、进行中、拒绝、Offer、本周新增和阶段分布。
3. 确认 active/offer 且最新日期恰好早 7 天的记录出现提醒，早 6 天的不出现。
4. 更新提醒记录或将其转为结束状态，确认提醒立即消失。

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

```bash
npx supabase db reset
npm run build
npm run start
```

预期：全新数据库可重建、生产构建成功、健康检查通过。部署数据库迁移前审查 SQL 并保留数据库备份；应用部署保留上一构建以快速回滚。对破坏性 schema 变化采用“扩展 → 数据迁移 → 收缩”，不得让应用回滚依赖已被删除的列。

## Traceability

- 业务范围与验收：[spec.md](./spec.md)
- 架构和质量门禁：[plan.md](./plan.md)
- 数据约束与事务：[data-model.md](./data-model.md)
- HTTP/Server Action 等价契约：[contracts/openapi.yaml](./contracts/openapi.yaml)
