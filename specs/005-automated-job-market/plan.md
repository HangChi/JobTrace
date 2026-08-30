# Implementation Plan: 自动招聘岗位市场

**Branch**: `codex/005-automated-job-market` | **Date**: 2026-08-30 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/005-automated-job-market/spec.md`

## Summary

在现有 Next.js 单体应用中新增独立的 `job-market` 业务模块，从已登记且合规的公开 ATS API、授权接口和受限的 Schema.org `JobPosting` 页面自动同步岗位。公共岗位与私人投递严格分表管理；首页改为“招聘广场”，以“企业 + 招聘活动/批次”为一条记录，合并岗位和地点，并在同一记录内提供统一或按岗位选择的官方投递链接。同步由外部调度器周期调用受密钥保护的内部 Route Handler，数据库租约保证多实例安全；来源失败只影响该来源，现有数据保持可读。

## Technical Context

**Language/Version**: TypeScript 5.9（strict）、Node.js 24、SQL/PL/pgSQL  
**Primary Dependencies**: Next.js 16 App Router、React 19、Better Auth 1.6、`postgres`/`pg`、Zod 4、date-fns；计划新增 Cheerio 1.x，仅用于不执行脚本地解析受限 Schema.org HTML  
**Storage**: PostgreSQL 17；公共岗位、来源、同步审计、收藏及私人投递关联使用独立关系表  
**Testing**: Vitest、Testing Library、临时 PostgreSQL 集成测试、pgTAP、Playwright、Lighthouse/现有性能脚本  
**Target Platform**: Node.js 自托管 Next.js standalone 服务；现代桌面和移动浏览器  
**Project Type**: 单仓库全栈 Web 应用，按领域模块划分  
**Performance Goals**: 招聘广场读接口 ≤500ms p95，收藏与记录投递写接口 ≤1s p95；筛选结果 95% 在 2s 内完整呈现；LCP ≤2.5s p75、INP ≤200ms p75、CLS ≤0.1  
**Constraints**: 登录后访问；管理员操作沿用现有 RBAC；后台同步不得阻塞交互请求；仅访问公开或授权来源；禁止绕过登录、验证码、反自动化或频率限制；同步日志不得含密钥、原始个人信息或未清洗 HTML  
**Scale/Scope**: 首期至少 100 家企业；设计容量为 100,000 个公共岗位/来源记录、10,000 名用户及其收藏；健康来源变化在 12 小时内反映；单次调度最多认领 10 个到期来源  

## Constitution Check

*GATE: Phase 0 前检查，并在 Phase 1 设计后复查。*

| 原则/门禁 | 设计响应 | Phase 0 | Phase 1 复查 |
|---|---|---|---|
| I. 可维护、最小复杂度 | 复用现有 application/domain/infrastructure/ui 分层；每个适配器只负责一种来源；不引入独立微服务或进程内调度器 | PASS | PASS |
| II. 测试是发布门禁 | 领域去重/生命周期单测、适配器契约测试、数据库集成测试、关键 E2E、SSRF/隐私回归与 ≥80% 行/分支覆盖 | PASS | PASS |
| III. 一致且无障碍 UX | 复用现有 token/组件，明确 loading/empty/stale/error/success，键盘操作、焦点、语义表格/卡片和响应式验证 | PASS | PASS |
| IV. 性能预算 | 分页与索引查询；同步与交互路径隔离；记录 500ms/1s API 预算和 Core Web Vitals 门禁 | PASS | PASS |
| 文档与公共契约 | OpenAPI、来源适配器契约、数据模型、调度和验证指南随计划产出 | PASS | PASS |
| 安全日志与秘密 | 内部同步密钥仅来自环境变量；日志只记录安全错误码与摘要；来源配置不保存凭据 | PASS | PASS |
| 回滚/缓解 | 功能开关、暂停全部来源、停止外部调度、保留现有私人投递入口；迁移采用向前兼容新增表 | PASS | PASS |

新增 Cheerio 是唯一计划中的运行时依赖：Node 端没有可靠的原生 HTML DOM 解析器，正则解析 JSON-LD 容易误读脚本边界；Cheerio 不执行页面脚本，影响被限制在 `schema_org` 适配器，并受响应体大小和超时约束。无宪章例外。

## Architecture and Design

### Module boundaries

- `job-market/domain`: 公共岗位、活动聚合、生命周期、去重和安全 URL 值对象，不依赖 Next.js 或数据库。
- `job-market/application`: 查询、收藏、来源管理、同步编排、记录私人投递的用例和端口。
- `job-market/infrastructure`: PostgreSQL 仓储、来源适配器、安全 HTTP 客户端及同步租约。
- `job-market/ui`: 招聘广场、聚合行/卡片、筛选器、投递选择器及管理员同步视图。
- `applications` 仍拥有私人投递。它只接受可选 `jobMarketPostId` 创建来源关联，不读取公共模块中的任何其他用户数据。

### Source strategy

首期实现 Greenhouse、Lever、Ashby、SmartRecruiters 公共接口适配器，以及仅针对管理员显式批准域名的 Schema.org `JobPosting` 适配器。所有适配器输出同一规范批次，保留来源身份和官方链接。自动发现只产生候选来源；未经合规确认不得启用。来源访问使用 HTTPS、精确主机白名单、DNS/IP 公网校验、逐跳重定向复验、超时、响应大小上限、内容类型限制和指数退避，不携带用户 Cookie 或内部凭据。

### Synchronization

外部平台 cron 每 5 分钟调用 `POST /api/internal/job-market/sync`。接口使用 `JOB_MARKET_SYNC_SECRET` 验证 Bearer token，在一个短事务中以 `FOR UPDATE SKIP LOCKED` 认领最多 10 个到期来源并设置租约；之后以有限并发执行，每个来源单独事务提交。成功来源根据完整快照新增、更新或推进缺失状态，失败来源保留最后一次成功数据并安排退避。管理员重试走单来源接口并产生独立运行记录。

来源一次成功完整快照未见岗位时标记 `stale`；第二次成功完整快照且至少相隔 6 小时仍未见时标记 `closed`。明确关闭或截止日期已过可立即关闭；重新出现则 `reopened`。一次请求失败绝不触发生命周期下架。

### Homepage and private workspace

- `/` 成为已登录用户的招聘广场。
- 现有私人投递首页移动到 `/applications`，导航明确提供“招聘广场”和“我的投递”。
- 招聘活动按公司与稳定批次键分页。查询在底层岗位/地点上匹配，但结果仍返回一条活动记录。
- 单一统一链接直接新窗口打开；存在多个岗位链接时，在该聚合记录内选择岗位后打开，不拆行。
- “记录投递”复用私人投递创建流程并保存快照；公共岗位后续变化不得覆盖用户状态、日期、阶段、备注或面试。

### Observability and release

每个同步运行记录来源、触发方式、耗时、发现/新增/更新/失效/隔离计数、结果和安全错误码，并通过现有结构化日志携带 request/run/source id。监控连续失败、租约超时、12 小时未成功和数据量突变。发布先创建表和关闭默认功能开关，再启用少量测试来源，验证后逐批扩到 100 家；回滚时停止调度、关闭市场入口并暂停来源，既有私人投递继续工作，新增表保留以便恢复和审计。

## Test Strategy

- **Unit**: 标题/地点规范化、批次键、主来源选择、保守去重、生命周期、URL 安全、活动投递模式、重复私人投递判断。
- **Contract**: 每种来源适配器使用固定夹具验证字段、分页、限流、异常数据和部分成功；OpenAPI 响应通过 Zod/schema 校验。
- **Integration**: PostgreSQL 唯一约束、租约竞争、幂等同步、跨来源合并、收藏隔离、应用关联隔离及状态推进。
- **Component**: 聚合岗位/地点摘要与展开、筛选、收藏、统一/多链接投递、loading/empty/stale/error 状态和键盘焦点。
- **E2E**: 自动同步到首页、直接投递、记录私人投递、重复提示、跨用户隐私、管理员诊断/重试。
- **Security/performance/accessibility**: SSRF 私网与重定向回归、危险 HTML/URL、日志脱敏、100k 岗位基准数据下 API p95、Lighthouse/Core Web Vitals、axe 与纯键盘流程。

所有外部来源测试必须使用本地固定夹具或 mock server，不访问真实招聘网站；变更代码须达到 80% 行覆盖和 80% 分支覆盖。

## Project Structure

### Documentation (this feature)

```text
specs/005-automated-job-market/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── openapi.yaml
│   └── source-adapter.md
└── tasks.md                 # 后续由 $speckit-tasks 生成
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── (protected)/
│   │   ├── page.tsx                         # 招聘广场
│   │   ├── applications/page.tsx            # 现有私人投递工作区
│   │   └── admin/job-market/page.tsx
│   └── api/
│       ├── job-market/campaigns/
│       ├── admin/job-market/
│       └── internal/job-market/sync/route.ts
├── modules/
│   ├── job-market/
│   │   ├── domain/
│   │   ├── application/
│   │   ├── infrastructure/
│   │   │   └── adapters/
│   │   └── ui/
│   └── applications/                        # 扩展创建契约与公共岗位关联
└── shared/
    ├── database/
    └── observability/

database/
├── migrations/
└── tests/

tests/
├── unit/job-market/
├── contract/job-market/
├── integration/job-market/
├── component/job-market/
├── e2e/job-market.spec.ts
├── fixtures/job-market/
└── performance/job-market-performance.ts
```

**Structure Decision**: 保持项目现有的 Next.js 单体和领域模块边界。Route Handler 只做鉴权、解析和响应映射；业务规则进入 `job-market` 模块，数据访问进入基础设施层。无需增加微服务、消息队列或第二个部署单元。

## Complexity Tracking

无宪章违规或需审批的复杂度例外。
