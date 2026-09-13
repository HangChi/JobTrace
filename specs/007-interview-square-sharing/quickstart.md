# Quickstart: 个人面经与面经广场

## Prerequisites

- Node.js 24、pnpm、uv 和可创建临时 PostgreSQL 数据库的本地环境。
- 当前分支为 `codex/007-interview-square-sharing`。

## Validation commands

```bash
pnpm typecheck
pnpm lint
pnpm test:unit
pnpm contract
pnpm integration
pnpm e2e
pnpm performance
```

## End-to-end validation

1. 使用用户 A 创建面经并确认默认显示“私有”。
2. 未完成时尝试公开，确认界面和接口均拒绝。
3. 完成后匿名发布；使用用户 B 在 `/interviews` 搜索并打开 `/interviews/shared/[id]`，确认无作者对象和私有字段。
4. 用户 A 切换署名；用户 B 刷新后只看到头像和用户名。
5. 用户 A 从头像菜单进入 `/interviews/mine`，按分享状态筛选并将面经改回私有。
6. 用户 B 再次访问公开详情，确认得到与不存在记录一致的 404。
7. 将公开面经重新发布后改回待复盘，确认自动下架提示与详情 404。

## Expected quality gates

- Requirements checklist complete。
- 所有自动化测试通过；变更代码行/分支覆盖率均不低于 80%。
- 公开响应严格符合 [OpenAPI contract](./contracts/openapi.yaml)，不含禁止字段。
- 375px 与桌面视口无横向溢出，键盘可完成菜单、公司搜索和发布流程。
