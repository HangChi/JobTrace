# Implementation Plan: 可定时的求职待办提醒

**Branch**: `codex/008-scheduled-reminders` | **Date**: 2026-09-27 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/008-scheduled-reminders/spec.md`

## Summary

在现有分析页“待处理进展”之上新增独立的 `reminders` 领域模块：用户可以为投递创建带事项时间、下一次通知时间和邮件开关的单次提醒，并完成、稍后提醒、取消或重新打开。现有阶段提醒继续由 analytics 推导，但通过明确的建议处置记录区分“完成、关闭、已转为提醒”。PostgreSQL 保存提醒状态、版本和通知尝试；受 Bearer 密钥保护的内部 Route Handler 由外部调度器每分钟调用，使用数据库原子认领和唯一键保证跨实例、重试时不重复发送。现有邮件 Webhook 增加 `scheduled_reminder` 模板，站内列表始终作为可靠回退。

## Technical Context

**Language/Version**: TypeScript 5.9、React 19.2、Python 3.12（现有 SMTP 适配器）  
**Primary Dependencies**: Next.js 16 App Router、Zod 4、postgres.js 3.4、date-fns 4、Better Auth 1.6（沿用现有依赖，不新增运行时依赖）  
**Storage**: PostgreSQL；新增提醒、建议处置、通知尝试三类持久数据  
**Testing**: Vitest + Testing Library（单元/组件）、Playwright（契约/集成/E2E）、Python unittest（邮件适配器）、现有临时 PostgreSQL 测试流程  
**Target Platform**: Node.js 服务端部署 + 现代桌面浏览器；外部 HTTPS 调度器；SMTP Webhook 适配器  
**Project Type**: 单仓库全栈 Web 应用  
**Performance Goals**: 提醒列表读取 p95 ≤ 500ms、交互写入 p95 ≤ 1s；95% 到期提醒在 60 秒内进入站内到期状态，95% 可发送邮件在 2 分钟内获得投递服务接收结果  
**Constraints**: Asia/Shanghai 单一业务时区；每条提醒一个下一次通知时间；邮件失败不丢失站内提醒；同一提醒/计划时间/渠道至多一个有效发送结果；用户数据强隔离；不依赖进程内定时器  
**Scale/Scope**: 每用户最多 10,000 条提醒；提醒创建编辑器、汇总列表、系统建议升级、用户 API、内部调度 API、邮件模板、运维与测试

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

### Pre-design gate

- **Maintainable Code**: PASS — 新功能放入单一 `reminders` 模块，analytics 仅保留建议推导；现有邮件边界通过一个新增联合类型扩展，不引入第二套投递实现。
- **Testing**: PASS — 计划覆盖时间计算、状态机、所有权、幂等认领、邮件失败、API 契约、组件交互和关键 E2E；先写行为测试再实现。
- **Accessible UX**: PASS — 复用 Dialog、Feedback、FormField、按钮与页面 token；所有状态、错误、焦点和键盘流程纳入验收。
- **Performance**: PASS — 为到期认领和用户列表建立面向查询的索引，内部任务批量有界，不阻塞交互请求；沿用宪法预算。
- **Complexity**: PASS — 复用已有外部 cron + Bearer Route Handler 模式，不引入队列、常驻 worker 或新依赖。

### Post-design gate

- **Maintainable Code**: PASS — 数据状态机、调度认领和邮件发送分为领域规则、应用服务、PostgreSQL 仓储与 Route Handler；公共契约集中定义。
- **Testing**: PASS — 数据模型中的每个状态转换和通知唯一性均映射到测试任务与 quickstart 场景。
- **Accessible UX**: PASS — 编辑器显示事项时间与实际通知时间，危险/不可逆操作使用明确文案；空、加载、成功、校验和失败状态都有规范。
- **Performance**: PASS — `owner_id/status/notify_at` 与全局到期认领索引覆盖核心读写；批处理默认 50、上限 100，单轮不进行无界扫描。
- **Security/Privacy**: PASS — 用户 Route Handler 每次校验会话与所有权；内部入口使用恒定时间 Bearer 比较；邮件只发送最少字段，日志不含令牌、邮箱正文或私人备注。

## Technical Design

### Scheduling and delivery

外部调度器每分钟调用 `POST /api/internal/reminders/deliver`。单次调用原子认领最多 50 条 `notify_at <= now()` 的待处理提醒：把提醒推进到 `due`，并为启用邮件且当前仍有已验证邮箱的记录创建带随机 claim token 和短租约的通知尝试。唯一键 `(reminder_id, scheduled_for, channel)` 阻止同一计划重复建单；发送完成后只有持有当前 claim token 的执行器能够写入 `sent` 或 `failed`。失败记录可由后续调度或用户操作受控重试，但已经 `sent` 的记录不可重发。

### Time semantics

浏览器以 `datetime-local` 收集北京时间墙上时间，并显式携带 `Asia/Shanghai` 语义；服务端统一转换为带时区时刻后校验。快捷提前量只决定初始 `notify_at`，数据库最终保存 `event_at` 与 `notify_at` 两个绝对时刻。稍后提醒仅更新 `notify_at`，不改变 `event_at`，并递增 reminder `version` 以拒绝陈旧编辑。

### Existing suggestion migration

现有 `progress_reminder_completions` 扩展为建议处置记录，增加 `resolution`（`completed`、`dismissed`、`scheduled`）和可选 `reminder_id`。旧行回填 `dismissed`，因为旧按钮文案是“不再提醒”，不能把历史数据误写成用户已完成。analytics 查询继续通过是否存在处置记录排除当前阶段建议；新阶段实例仍会生成新建议。

### UI composition

- `ReminderEditorDialog` 从投递详情和建议条目打开，预填公司/岗位语境和建议文案。
- `ReminderPanel` 替换现有 `ProgressReminderList` 的单一列表，分为“已到时间”“接下来”“系统建议”，默认只展示待处理内容。
- 完成与稍后提醒为主操作；关闭建议、取消提醒放入低强调度并提供明确确认。
- 第一版直接集成现有投递首页的 AnalyticsPanel，不新增顶级导航，避免用户在“投递”和“提醒”之间来回切换；提醒历史通过面板状态筛选访问。

## Project Structure

### Documentation (this feature)

```text
specs/008-scheduled-reminders/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── openapi.yaml
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── (protected)/applications/[id]/page.tsx
│   ├── api/reminders/route.ts
│   ├── api/reminders/[id]/route.ts
│   ├── api/reminders/[id]/complete/route.ts
│   ├── api/reminders/[id]/snooze/route.ts
│   ├── api/reminders/[id]/reopen/route.ts
│   ├── api/reminders/[id]/retry-email/route.ts
│   ├── api/analytics/progress-reminders/[stageOccurrenceId]/resolve/route.ts
│   └── api/internal/reminders/deliver/route.ts
├── modules/
│   ├── reminders/
│   │   ├── application/
│   │   ├── domain/
│   │   ├── infrastructure/
│   │   ├── ui/
│   │   └── index.ts
│   ├── analytics/
│   └── identity-access/infrastructure/email-delivery.server.ts
└── shared/config/env.ts

deploy/mail-adapter/
├── app.py
└── test_app.py

supabase/migrations/
└── 20260927000300_scheduled_reminders.sql

tests/
├── unit/reminders/
├── component/reminders/
├── contract/reminders.contract.test.ts
├── integration/reminders/
├── e2e/reminders.spec.ts
└── performance/reminder-performance.ts

.github/workflows/reminder-delivery.yml
```

**Structure Decision**: 沿用仓库的领域模块 + App Router Route Handler 结构。`reminders` 拥有主动提醒生命周期和调度投递；`analytics` 只负责系统建议来源及其展示组合；邮件适配器继续作为独立、最小权限的 SMTP 边界。

## Complexity Tracking

无宪法例外或新增基础设施层；无需复杂度豁免。
