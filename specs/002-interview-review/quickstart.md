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
3. 保存至少 3 个问题，分别填写原始回答、追问和复盘后的回答。
4. 填写亮点、待改进点，添加一个行动项并保存。
5. 重新打开面经，确认问题顺序、内容和行动项状态保持不变。
6. 对二面重复上述流程，确认两篇面经互不覆盖。

## 5. Journey B — Draft, autosave and completion

1. 创建面经后只填写基础信息和一个问题，确认状态为草稿或待复盘。
2. 输入较长的回答并等待保存提示；刷新页面，确认最近一次保存内容仍在。
3. 在没有改进内容/行动项时尝试标记完成，确认操作被阻止且错误靠近相关区域。
4. 添加复盘后的回答或行动项后再次完成，确认状态变为“已完成”。
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
3. 仅用键盘完成阶段关联、添加问题、保存、筛选、行动项勾选和删除确认。
4. 使用 axe 检查表单标签、错误关联、对话框焦点、动态保存状态和颜色对比。

## 9. Performance validation

使用固定种子生成每用户最多 10,000 篇面经，至少预热后测量三轮：

- 搜索/组合筛选 p95 ≤ 1 秒；创建、更新、删除、行动项勾选反馈 p95 ≤ 1 秒。
- LCP p75 ≤ 2.5 秒、INP p75 ≤ 200ms、CLS ≤ 0.1。
- 面经列表分页无重复/遗漏；投递详情阶段面经摘要与面经列表一致。

任一预算失败即阻止发布，保留测量输出和数据规模说明。
