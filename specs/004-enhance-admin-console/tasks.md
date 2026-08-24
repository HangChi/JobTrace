---

description: "管理员后台增强的依赖有序实施任务"
---

# Tasks: 管理员后台增强

**Input**: Design documents from `/specs/004-enhance-admin-console/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md

**Tests**: 项目宪法要求所有行为变更在最低有效层级具备自动化测试，关键用户旅程必须有 E2E；各故事中的测试任务须先编写并确认在实现前失败。

**Organization**: 任务按用户故事分组，确保每个故事都能作为独立增量实现、验收和交付。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可与同阶段其他任务并行（不同文件且不依赖未完成任务）
- **[Story]**: 对应规格中的用户故事（US1–US4）
- 每项任务均包含明确文件路径

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 为管理员故事建立可复用、可隔离的测试数据入口，不改变生产行为。

- [X] T001 在 `tests/fixtures/admin-console.ts` 添加管理员、普通用户、禁用用户、Session、业务数量和审计事件的确定性 fixture builders，并在 `tests/setup/database.ts` 暴露仅供隔离测试使用的插入辅助函数

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 建立所有管理员故事共享的数据约束、输入/DTO 契约、安全入口和后台布局。

**⚠️ CRITICAL**: 本阶段完成前不得开始任何用户故事实现。

- [X] T002 [P] 在 `supabase/tests/005_admin_console_test.sql` 编写失败优先的数据库测试，覆盖 `users.access_version`、审计新字段/外键快照/唯一 request ID、查询索引和审计 UPDATE/DELETE 拒绝
- [X] T003 [P] 在 `tests/unit/identity-access/admin-contracts.test.ts` 编写失败优先的单元测试，覆盖用户/审计查询规范化、上海时区日期范围、动作枚举、原因 10–500 字符、预期版本、request ID 和最小 DTO 白名单
- [X] T004 根据 T002 在 `supabase/migrations/20260824000100_admin_console_enhancement.sql` 添加 `access_version`、扩展并回填 `admin_audit_events`、调整可空 `ON DELETE SET NULL` 外键、保留只追加触发器并创建用户/Session/审计查询索引
- [X] T005 运行类型生成流程并更新 `src/generated/database.types.ts`，确保新增访问版本、审计字段和数据库函数类型由迁移生成且 `pnpm db:types:check` 无漂移
- [X] T006 根据 T003 在 `src/modules/identity-access/application/admin-query-schema.ts` 实现查询/动作 Zod schemas，并在 `src/modules/identity-access/application/contracts.ts` 定义 AdminOperationalSummary、ManagedUser、AccessChange 和 AdminAudit DTO
- [X] T007 [P] 在 `tests/unit/identity-access/admin-request-security.test.ts` 编写失败优先的同源写入测试，覆盖合法 Origin、恶意 Origin、无 Origin 服务端调用和无配置错误
- [X] T008 根据 T007 在 `src/shared/http/request-security.ts` 实现可复用同源校验，并重构 `src/modules/identity-access/infrastructure/auth-request-security.ts` 复用该校验而不改变现有认证行为
- [X] T009 [P] 在 `src/app/admin/layout.tsx` 和 `src/modules/identity-access/ui/admin-nav.tsx` 建立 `requirePageAdmin` 保护、管理员区域语义及“概览/用户/审计”导航，并在 `src/app/globals.css` 添加所需响应式后台布局样式

**Checkpoint**: 数据迁移、类型、查询/动作契约、写入来源校验和后台公共布局就绪；US1–US4 可以在协调共享仓储文件的前提下开始。

---

## Phase 3: User Story 1 - 快速掌握平台状态 (Priority: P1) 🎯 MVP

**Goal**: 管理员可查看全局账号/业务计数、7/30 天注册与活跃统计、30 天趋势和清晰的数据可用状态，非管理员无法取得摘要。

**Independent Test**: 使用角色、状态、业务数量和 Session 日期已知的数据集打开 `/admin`，逐项核对摘要和上海时区趋势；真实零值与查询失败必须可区分，访客/普通用户/禁用管理员均不得看到数据。

### Tests for User Story 1

> **NOTE**: 先完成 T010–T013 并确认失败，再开始本故事实现。

- [X] T010 [P] [US1] 在 `tests/contract/admin-console.contract.test.ts` 添加 `GET /api/admin/summary` 的 200 DTO、分区 unavailable、401、403 和去敏 Problem 契约测试
- [X] T011 [P] [US1] 在 `tests/integration/identity-access/admin-summary.test.ts` 添加全局计数、7/30 天窗口、跨午夜上海时区边界、不同用户去重活跃、禁用用户排除和 30 天补零趋势测试
- [X] T012 [P] [US1] 在 `tests/component/identity-access/admin-summary.test.tsx` 添加可用零值、无数据、局部不可用、生成时间/统计口径和辅助技术状态反馈测试
- [X] T013 [P] [US1] 在 `tests/e2e/admin-console.spec.ts` 添加访客、普通用户、禁用管理员和有效管理员访问 `/admin` 的授权矩阵及摘要准确性旅程

### Implementation for User Story 1

- [X] T014 [US1] 在 `src/modules/identity-access/infrastructure/postgres-admin-repository.ts` 实现全局计数、7/30 天窗口和最近 30 个 `Asia/Shanghai` 自然日趋势查询，使用独立 section 结果区分零值与 unavailable
- [X] T015 [US1] 在 `src/modules/identity-access/application/admin-summary-service.ts` 组合授权、生成时间、时区、活跃口径和部分失败映射，并保证返回 DTO 不含 Session/IP/业务正文
- [X] T016 [US1] 在 `src/app/api/admin/summary/route.ts` 对接新摘要服务、Problem 包络和请求时动态读取，保持 GET 不启用共享缓存
- [X] T017 [P] [US1] 在 `src/modules/identity-access/ui/admin-summary.tsx` 实现账号/业务指标卡、7/30 天活动和 30 天趋势的 available/empty/unavailable 展示及非颜色状态标签
- [X] T018 [US1] 重构 `src/app/admin/page.tsx` 为运营概览 Server Component，接入管理员摘要、统计口径、生成时间和进入用户目录的行动入口
- [X] T019 [P] [US1] 在 `src/app/admin/loading.tsx` 和 `src/app/admin/error.tsx` 实现语义化加载、失败与安全重试状态，并避免把未知统计显示为零

**Checkpoint**: `/admin` 运营概览可独立发布；无需用户目录、写操作或审计页面即可完成 US1 验收。

---

## Phase 4: User Story 2 - 定位并了解用户 (Priority: P1)

**Goal**: 管理员可按账号、角色、状态和注册日期定位用户，稳定分页并查看只含账号元数据、数量和最近变更摘要的详情。

**Independent Test**: 在 10,000 用户代表性数据集中完成完整/部分账号检索、组合筛选、翻页、刷新、详情与返回；核对总数、稳定顺序、空状态、业务计数和隐私字段缺失。

### Tests for User Story 2

> **NOTE**: 先完成 T020–T024 并确认失败，再开始本故事实现。

- [X] T020 [P] [US2] 在 `tests/unit/identity-access/admin-user-query.test.ts` 添加空白/过长/特殊字符搜索、角色/状态/日期组合、倒置日期、无效页码和 URL round-trip 测试
- [X] T021 [P] [US2] 扩展 `tests/contract/admin-console.contract.test.ts`，覆盖 `GET /api/admin/users` 与 `GET /api/admin/users/{id}` 的分页 DTO、400、401、403、404 及敏感字段缺失
- [X] T022 [P] [US2] 在 `tests/integration/identity-access/admin-user-query.test.ts` 添加部分/精确账号匹配、组合筛选、总数、`created_at/id` 稳定分页、越界页、最近登录及投递/面经无重复计数测试
- [X] T023 [P] [US2] 在 `tests/component/identity-access/admin-user-directory.test.tsx` 添加筛选恢复、空状态/清除筛选、宽屏表格、窄屏具名卡片、从未登录标签和详情最小字段测试
- [X] T024 [P] [US2] 扩展 `tests/e2e/admin-console.spec.ts`，覆盖用户检索/组合筛选/翻页/刷新/详情/返回状态保持以及网络响应不含求职正文、Session、IP 或 user-agent

### Implementation for User Story 2

- [X] T025 [US2] 在 `src/modules/identity-access/infrastructure/postgres-admin-repository.ts` 实现规范化用户名/内部邮箱匹配、角色/状态/注册日期组合过滤、匹配总数和 `created_at desc, id desc` 稳定页码分页
- [X] T026 [US2] 在 `src/modules/identity-access/infrastructure/postgres-admin-repository.ts` 实现单用户最小详情、分页内用户业务数量聚合、最近登录和最近 10 条审计摘要查询，避免一对多 join 计数膨胀
- [X] T027 [US2] 在 `src/modules/identity-access/application/admin-user-service.ts` 实现查询校验、越界页规范化、管理员授权、列表/详情 DTO 白名单和 not-found 映射
- [X] T028 [P] [US2] 更新 `src/app/api/admin/users/route.ts` 以解析全部查询参数并返回 ManagedUserPage/Problem 契约
- [X] T029 [P] [US2] 在 `src/app/api/admin/users/[id]/route.ts` 添加 GET 详情处理器，并按 Next.js 16 Promise params 约定校验 ID 与映射 404
- [X] T030 [P] [US2] 在 `src/modules/identity-access/ui/admin-user-filters.tsx` 和 `src/modules/identity-access/ui/user-admin-table.tsx` 实现 URL 驱动筛选、结果总数、分页、空/错误状态及宽窄屏可访问布局
- [X] T031 [P] [US2] 在 `src/modules/identity-access/ui/admin-user-detail.tsx` 实现账号资料、访问状态、最近登录、业务数量和最近变更摘要，明确排除个人求职内容
- [X] T032 [US2] 在 `src/app/admin/users/page.tsx` 和 `src/app/admin/users/[id]/page.tsx` 组合 Server Component 查询、not-found、筛选返回链接和用户目录/详情 UI

**Checkpoint**: US2 可在只读模式独立验收；管理员无需启用访问变更即可完成规模化定位和支持信息核对。

---

## Phase 5: User Story 3 - 安全地管理账号访问 (Priority: P2)

**Goal**: 管理员能以单一具名动作、原因、版本和 request ID 安全变更角色/状态；并发、重复、自我操作和最后管理员风险被确定性处理并审计。

**Independent Test**: 使用两个有效管理员、一个普通用户和一个禁用用户执行提升、降级、禁用、启用、自我操作、最后管理员、并发旧版本、响应丢失重试及相同 ID 不同载荷，核对账号、Session、版本、反馈和审计。

### Tests for User Story 3

> **NOTE**: 先完成 T033–T037 并确认失败，再开始本故事实现。

- [X] T033 [P] [US3] 在 `tests/unit/identity-access/admin-access-action.test.ts` 添加动作/当前状态矩阵、原因保留、强化自我确认、请求指纹稳定性和访问冲突错误映射测试
- [X] T034 [P] [US3] 在 `tests/integration/identity-access/admin-access-change.test.ts` 添加原子角色/状态更新、版本递增、Session 撤销、启用不恢复 Session、并发最后管理员保护、旧版本冲突、成功/拒绝审计和幂等重放测试
- [X] T035 [P] [US3] 扩展 `tests/contract/admin-console.contract.test.ts`，覆盖 `PATCH /api/admin/users/{id}` 的 200/replayed、400、401、403、404 及版本/最后管理员/自我确认/幂等 409 契约
- [X] T036 [P] [US3] 在 `tests/component/identity-access/admin-access-dialog.test.tsx` 添加目标与前后状态、原因验证、强化确认、pending 防重复、成功、冲突、未知结果保留 request ID/原因和焦点恢复测试
- [X] T037 [P] [US3] 扩展 `tests/e2e/admin-console.spec.ts`，覆盖四种动作、禁用后旧会话失效、自我降级/禁用、最后管理员、双管理员并发和响应丢失后的同 request ID 安全重试

### Implementation for User Story 3

- [X] T038 [US3] 在 `supabase/migrations/20260824000100_admin_console_enhancement.sql` 实现原子 `change_user_access_as` 函数，完成 actor/target 锁、版本/动作/自我/最后管理员判断、request fingerprint 幂等、状态更新、Session 删除及 succeeded/denied/conflict 审计
- [X] T039 [US3] 在 `src/modules/identity-access/infrastructure/postgres-admin-repository.ts` 实现访问变更命令调用、结果/重放读取和最新安全状态映射，确保参数化查询且不把原因写服务日志
- [X] T040 [US3] 在 `src/modules/identity-access/application/admin-user-service.ts` 实现动作 schema 校验、管理员授权、同源写入所需命令 DTO、数据库结果到 200/409 Problem 的确定性映射及去敏结构化 outcome 日志
- [X] T041 [US3] 更新 `src/app/api/admin/users/[id]/route.ts` 的 PATCH 处理器，执行同源校验、JSON 输入校验、Promise params 解析并返回 AccessChangeResponse/Problem
- [X] T042 [P] [US3] 在 `src/modules/identity-access/ui/admin-access-dialog.tsx` 实现四种动作确认、10–500 字符原因、强化自我确认、稳定 request ID、pending/成功/冲突/未知反馈和安全重试
- [X] T043 [US3] 更新 `src/modules/identity-access/ui/admin-user-detail.tsx` 和 `src/modules/identity-access/ui/user-admin-table.tsx` 接入访问对话框、最新 `accessVersion`、成功刷新及冲突后重新确认流程
- [X] T044 [US3] 更新 `src/modules/identity-access/index.ts` 仅导出管理员公开 DTO/服务/校验入口，并删除旧自由字段访问变更调用路径，确保普通业务模块不能绕过具名动作和版本保护

**Checkpoint**: US3 的访问变更闭环独立可用；任何成功状态变化都原子撤销所需 Session 并产生唯一审计，任何业务拒绝都不改变账号。

---

## Phase 6: User Story 4 - 审查管理操作 (Priority: P3)

**Goal**: 管理员可只读查看成功、拒绝、冲突和失败审计，按操作者、目标、动作、结果及日期组合筛选，账号删除或改名后历史仍可辨认。

**Independent Test**: 直接准备或通过 US3 生成多类审计事件，组合全部筛选并核对总数/分页/前后状态/原因；尝试修改删除审计必须失败，删除关联用户后仍显示事件时身份快照。

### Tests for User Story 4

> **NOTE**: 先完成 T045–T048 并确认失败，再开始本故事实现；可直接 seed 审计，不依赖 US3 UI。

- [X] T045 [P] [US4] 在 `tests/unit/identity-access/admin-audit-query.test.ts` 添加操作者/目标文本规范化、动作/结果、上海时区日期范围、无效范围、页码和 URL round-trip 测试
- [X] T046 [P] [US4] 扩展 `tests/contract/admin-console.contract.test.ts`，覆盖 `GET /api/admin/audit-events` 的只读分页 DTO、组合筛选、400、401、403 及身份快照字段
- [X] T047 [P] [US4] 在 `tests/integration/identity-access/admin-audit-query.test.ts` 添加 actor/target 当前 ID 与快照匹配、类型/结果/日期组合、稳定分页、用户删除后快照保留及 UPDATE/DELETE 拒绝测试
- [X] T048 [P] [US4] 在 `tests/component/identity-access/admin-audit-directory.test.tsx` 添加筛选恢复、结果总数、空/失败状态、前后值、原因、删除账号标签、窄屏布局及无编辑/删除/导出入口测试

### Implementation for User Story 4

- [X] T049 [US4] 在 `src/modules/identity-access/infrastructure/postgres-admin-repository.ts` 实现操作者/目标当前标识与快照匹配、动作/结果/上海日期组合过滤、总数及 `created_at desc, id desc` 审计分页
- [X] T050 [US4] 在 `src/modules/identity-access/application/admin-audit-service.ts` 实现查询校验、管理员授权、身份删除标记、前后访问状态白名单和审计 DTO 映射
- [X] T051 [US4] 在 `src/app/api/admin/audit-events/route.ts` 实现只读 GET Route Handler、完整查询参数解析和 AdminAuditPage/Problem 响应，不提供任何写方法
- [X] T052 [P] [US4] 在 `src/modules/identity-access/ui/admin-audit-filters.tsx` 和 `src/modules/identity-access/ui/admin-audit-table.tsx` 实现 URL 筛选、总数/分页、前后值、原因、结果、删除账号与响应式只读展示
- [X] T053 [US4] 在 `src/app/admin/audit/page.tsx` 组合审计 Server Component、查询状态、空/失败状态和管理员导航，不渲染编辑、删除或导出操作
- [X] T054 [US4] 更新 `src/modules/identity-access/index.ts` 导出审计查询公开入口，并在 `src/app/admin/users/[id]/page.tsx` 将最近事件链接到带目标筛选的 `/admin/audit` 页面

**Checkpoint**: US4 可用直接 seed 的事件独立验收；审计只读性、历史身份快照和全部筛选均得到验证。

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 完成跨故事安全、可访问性、性能、诊断、运维与发布门禁。

- [X] T055 [P] 在 `tests/e2e/admin-console-accessibility.spec.ts` 覆盖 375px/768px/1280px、键盘导航、对话框焦点、动态状态播报、非颜色提示和 axe WCAG 2.2 AA 检查
- [X] T056 [P] 在 `tests/e2e/admin-console-security.spec.ts` 覆盖访客/普通/禁用管理员的全部后台页面与接口拒绝、CSRF、个人求职正文/Session/IP/user-agent 不泄露和普通业务 owner 隔离回归
- [X] T057 [P] 在 `tests/performance/admin-console-seed.ts` 实现只面向隔离临时数据库的 10,000 用户、分布 Session/业务计数和 100,000 审计事件确定性种子及强制清理
- [X] T058 在 `tests/performance/admin-console-performance.ts` 实现摘要、用户组合筛选/详情、审计组合筛选 p95 ≤2s 和账号写入 p95 ≤1s 门禁，并在 `package.json` 接入现有 `performance` 隔离运行链
- [X] T059 [P] 在 `tests/integration/observability/admin-console-logging.test.ts` 验证管理日志包含 request ID、actor/target ID、动作、结果码和耗时，同时排除搜索文本、原因、邮箱、Cookie、Session、IP/user-agent 与求职正文
- [X] T060 更新 `docs/operations.md` 和 `README.md`，记录管理员后台路由、活跃口径、审计保留、首个/最后管理员、禁用会话、扩展式迁移、监控字段和只回滚应用不删除审计数据的流程
- [X] T061 按 `specs/004-enhance-admin-console/quickstart.md` 完成全部用户旅程、并发/幂等、只读审计、窄屏和回滚演练，并将实际命令、数据规模与结果追加到该文件的 Validation Record
- [X] T062 运行 `pnpm format`、`pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm db:reset:verify`、`pnpm db:types:check`、`pnpm db:test`、`pnpm contract`、`pnpm integration`、`pnpm e2e`、`pnpm performance`、`pnpm performance:auth`、`pnpm lighthouse` 和 `pnpm build`，将覆盖率/性能/无障碍结果记录到 `specs/004-enhance-admin-console/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 无依赖，可立即开始。
- **Foundational (Phase 2)**: 依赖 T001；T002/T003/T007/T009 可先并行，随后按“失败测试 → 实现 → 生成类型”完成；阻塞全部用户故事。
- **US1 (Phase 3)**: 依赖 Foundational；是建议 MVP。
- **US2 (Phase 4)**: 依赖 Foundational；与 US1 在产品语义上独立，但二者修改 `postgres-admin-repository.ts` 时须串行或明确协调。
- **US3 (Phase 5)**: 依赖 Foundational；可直接在目标详情测试，但完整 UI 入口集成依赖 US2 的详情/列表组件。
- **US4 (Phase 6)**: 依赖 Foundational；查询可通过 fixture 直接 seed 独立开发，链接集成 T054 依赖 US2；使用真实变更生成事件的 E2E 依赖 US3。
- **Polish (Phase 7)**: 依赖计划交付的全部用户故事；T055/T056/T057/T059 可并行，T058 依赖 T057，T061/T062 最后串行。

### User Story Completion Order

```text
Setup → Foundation
             ├── US1 运营概览（MVP）
             ├── US2 用户定位 ──┐
             └── US4 审计查询   │（可直接 seed）
                    US2 ──> US3 安全变更 ──> US4 真实事件集成
                                      └────> Polish / Release Gates
```

- **US1 (P1)**: Foundation 后可独立完成，无其他故事依赖。
- **US2 (P1)**: Foundation 后可独立完成；为 US3 提供完整用户操作入口。
- **US3 (P2)**: 数据/接口可在 Foundation 后开发；UI 集成在 US2 后完成。
- **US4 (P3)**: 只读查询可在 Foundation 后用 fixture 独立完成；真实事件链接在 US2/US3 后完成。

### Within Each User Story

1. 先编写本故事所有测试并确认失败。
2. 数据库/仓储查询或原子函数先于应用服务。
3. 应用服务先于 Route Handler 和页面组合。
4. 独立 UI 可与仓储实现并行，但集成任务等待服务/接口。
5. 完成本故事 Checkpoint 后再进入下一优先级或发布增量。

### Parallel Opportunities

- T002、T003、T007、T009 分属数据库、应用契约、安全和布局文件，可并行。
- 每个故事标记 `[P]` 的 contract/integration/component/E2E 测试位于不同文件，可并行编写后统一确认失败。
- US1 的摘要 UI（T017/T019）可与查询/服务链并行；US2 的两个 Route Handlers 与目录/详情 UI（T028–T031）可并行。
- US3 的确认对话框 T042 可与数据库/服务链 T038–T041 并行；US4 的只读 UI T052 可与查询/服务链 T049–T051 并行。
- 最终无障碍、安全、性能种子和日志测试 T055/T056/T057/T059 可并行。

---

## Parallel Example: User Story 1

```text
Task T010: tests/contract/admin-console.contract.test.ts
Task T011: tests/integration/identity-access/admin-summary.test.ts
Task T012: tests/component/identity-access/admin-summary.test.tsx
Task T013: tests/e2e/admin-console.spec.ts

完成失败测试后并行：
Task T014–T016: 摘要仓储 → 服务 → Route Handler
Task T017: src/modules/identity-access/ui/admin-summary.tsx
Task T019: src/app/admin/loading.tsx + src/app/admin/error.tsx
```

## Parallel Example: User Story 2

```text
Task T020: tests/unit/identity-access/admin-user-query.test.ts
Task T021: tests/contract/admin-console.contract.test.ts
Task T022: tests/integration/identity-access/admin-user-query.test.ts
Task T023: tests/component/identity-access/admin-user-directory.test.tsx
Task T024: tests/e2e/admin-console.spec.ts

服务就绪后并行：T028、T029、T030、T031
```

## Parallel Example: User Story 3

```text
Task T033: tests/unit/identity-access/admin-access-action.test.ts
Task T034: tests/integration/identity-access/admin-access-change.test.ts
Task T035: tests/contract/admin-console.contract.test.ts
Task T036: tests/component/identity-access/admin-access-dialog.test.tsx
Task T037: tests/e2e/admin-console.spec.ts

基础契约就绪后，T042 可与 T038 → T039 → T040 → T041 并行。
```

## Parallel Example: User Story 4

```text
Task T045: tests/unit/identity-access/admin-audit-query.test.ts
Task T046: tests/contract/admin-console.contract.test.ts
Task T047: tests/integration/identity-access/admin-audit-query.test.ts
Task T048: tests/component/identity-access/admin-audit-directory.test.tsx

失败测试就绪后，T052 可与 T049 → T050 → T051 并行。
```

---

## Implementation Strategy

### MVP First: User Story 1

1. 完成 Phase 1 的 fixture 基础。
2. 完成 Phase 2 的迁移、类型、输入/DTO、安全和管理员布局。
3. 完成 Phase 3 的运营摘要测试与实现。
4. 停止并按 US1 Independent Test 单独验收。
5. 若只需首个可见增量，可发布概览 MVP；现有用户管理基线仍保持可用。

### Recommended Incremental Delivery

1. **MVP**: Setup + Foundation + US1，提供准确且受保护的运营概览。
2. **Read-only operations**: US2，提供用户定位与隐私受限详情。
3. **Safe mutations**: US3，在稳定详情入口上加入原子、并发安全、幂等的访问变更。
4. **Governance**: US4，开放只读审计查询和历史追踪。
5. **Release**: 完成跨故事可访问性、安全、性能、诊断、文档与全部门禁。

### Single-Agent Execution

1. 严格按 T001 → T062 的依赖顺序执行。
2. 同一阶段仅在 `[P]` 任务之间切换，避免同时编辑 `postgres-admin-repository.ts`、`admin-console.contract.test.ts` 或 `admin-console.spec.ts`。
3. 每个故事先让测试失败，再完成实现和独立验收；在 Checkpoint 处提交或记录可恢复状态。

---

## Notes

### Phase 9: Follow-up — 只读求职档案与详情视觉优化

- [X] T063 更新规格、计划、OpenAPI 与运维文档，将指定用户投递/面经只读查看纳入管理员权限边界
- [X] T064 在管理员仓储、服务和详情 Route 中实现独立分页的投递、阶段、备注、面经问题/回答与行动项读取，并记录无正文安全日志
- [X] T065 重构用户目录为紧凑五列表格与窄屏账号卡片，重构详情为账号档案、内容主栏和访问控制/审计侧栏
- [X] T066 添加组件、HTTP 契约和真实数据库集成测试，覆盖正文、分页规范化、只读控制与敏感认证数据排除
- [X] T067 运行格式、类型、Lint、生产构建、单元、契约、集成及管理员端到端安全/无障碍门禁并修复发现的问题

- `[P]` 仅表示不同文件且不存在未完成依赖，不表示必须并行执行。
- `[US1]`–`[US4]` 提供从任务到用户故事的追踪。
- 数据库迁移是 schema 唯一事实来源；`src/generated/database.types.ts` 只能由生成流程更新。
- 不要删除、弱化或跳过现有授权、owner 隔离、审计不可变和覆盖率测试来使门禁通过。
- 任何范围外能力（用户删除、批量变更、自定义角色、密码重置、通知、审计导出）应另建规格，不在本任务列表中顺带实现。
