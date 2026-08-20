# Quickstart & Validation: 面试面经记录与复盘

本指南用于实现完成后的端到端验证；接口字段与响应结构见 [contracts/openapi.yaml](./contracts/openapi.yaml)，数据约束见 [data-model.md](./data-model.md)。

## Prerequisites

- Node.js 24 LTS、pnpm、Python 3.12 与 uv
- 可访问的 PostgreSQL 实例和项目认证环境变量
- 支持的桌面浏览器，以及用于窄视口验证的浏览器设备模拟

## 1. Configure and migrate

```bash
pnpm install
pnpm db
pnpm db:types
pnpm db:test
pnpm typecheck
```

预期：面经迁移可在空数据库和现有投递数据上重放；阶段、面经、问题和行动项约束通过；生成类型没有未提交漂移。

## 2. Run quality gates

```bash
pnpm format
pnpm lint
pnpm typecheck
pnpm test
pnpm integration
pnpm contract
```

预期：单元、组件、数据库集成和 HTTP 契约全部通过，变更代码行/分支覆盖率不低于项目宪章要求的 80%。

## 3. Start and inspect navigation

```bash
pnpm dev
```

以普通用户登录，确认顶层导航提供“投递”和“面经”；访问 `/interviews`，空数据时显示“从已有投递记录一场面试”的入口。

## 4. Journey A — From stage to review

1. 创建一条投递记录，补录一面（今天）和二面（另一个有效日期）。
2. 在一面时间线点击“记录面经”，确认公司、岗位、轮次和日期已预填。
3. 在唯一内容框中填写包含标题、列表和代码片段的 Markdown 面经。
4. 切换到预览，确认 Markdown 排版正确，再返回编辑并等待自动保存。
5. 重新打开面经，确认 Markdown 原文和预览内容保持不变。
6. 对二面重复上述流程，确认两篇面经互不覆盖。

## 5. Journey B — Draft, autosave and completion

1. 创建面经后只填写基础信息，确认状态为草稿。
2. 输入较长的 Markdown 并等待保存提示；刷新页面，确认最近一次保存内容仍在。
3. 清空内容后尝试标记完成，确认操作被阻止且错误靠近编辑区域。
4. 填写非空 Markdown 后再次完成，确认状态变为“已完成”。
5. 使用第二个浏览器标签修改同一篇面经，再从旧标签保存，确认显示版本冲突，不覆盖新内容。

## 6. Journey C — Stage and application lifecycle

1. 关联一篇面经后修改阶段展示信息/日期，确认面经仍指向相同阶段发生记录并显示最新信息。
2. 删除该阶段，确认对话框说明“面经会解除关联但不会删除”；确认后面经仍可打开，并展示快照轮次和日期。
3. 从面经入口选择同一投递和新的面试轮次/日期，确认未记录阶段时系统一次性创建阶段与面经。
4. 删除投递，确认删除提示包含关联面经；确认后投递及其面经、问题和行动项均不可访问。

## 7. Journey D — Search, filters and navigation

1. 准备不同公司、岗位、轮次、结果和复盘状态的面经。
2. 在 `/interviews` 使用公司/岗位/问题关键词搜索，组合轮次、状态、结果和日期范围筛选。
3. 刷新页面，确认 URL 条件和列表结果保持；清除筛选后恢复默认最近优先排序。
4. 从投递详情点击某篇面经，确认能进入面经详情并返回原投递。

## 8. Journey E — Owner isolation and accessibility

1. 用户 A、B 各创建面经；A 使用 B 的面经 UUID 请求 GET/PATCH/DELETE。
2. 预期跨 owner 请求统一拒绝且不泄露资源存在性，A/B 列表和搜索互不混入。
3. 仅用键盘完成阶段关联、Markdown 编辑与预览、保存、筛选和删除确认。
4. 使用 axe 检查表单标签、错误关联、对话框焦点、动态保存状态和颜色对比。

## 9. Performance validation

使用固定种子生成每用户最多 10,000 篇面经，至少预热后测量三轮：

- 搜索/组合筛选 p95 ≤ 1 秒；创建、更新和删除反馈 p95 ≤ 1 秒。
- LCP p75 ≤ 2.5 秒、INP p75 ≤ 200ms、CLS ≤ 0.1。
- 面经列表分页无重复/遗漏；投递详情阶段面经摘要与面经列表一致。

任一预算失败即阻止发布，保留测量输出和数据规模说明。

## 10. Validation record (2026-08-20)

本功能在隔离测试数据库和 production build 上完成以下门禁：

- `pnpm format`、`pnpm lint`、`pnpm typecheck`、`pnpm build`：通过。
- `pnpm test`：31 个测试文件、81 项测试通过；行覆盖率 96.44%，分支覆盖率 88.42%。
- `pnpm contract`：10 项 HTTP 契约测试通过。
- `pnpm integration`：16 项数据库集成测试通过。
- `pnpm e2e`：26 项 E2E/无障碍/隔离用例均获得通过结果；覆盖 375px、768px、1280px 视口。
- `pnpm db:reset:verify`、`pnpm db:types:check`、隔离库 `pnpm db:test`：通过。
- `pnpm performance`：10,000 条面经下列表 p95 52.69ms、筛选 29.01ms、搜索 36.74ms、聚合更新 26.73ms。
- `pnpm performance:auth`：鉴权与角色路由 p95 门禁通过。
- `pnpm lighthouse`：production build 三轮 LCP ≤ 2.5s、CLS ≤ 0.1 门禁通过。
