# Tasks: 职迹简历投递管理

**Input**: Design documents from `/specs/001-resume-application-tracking/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md

**Tests**: 项目宪章要求测试作为发布门禁。每个故事的测试任务必须先完成并确认失败，再开始对应实现。

**Organization**: 任务按用户故事分组；每个故事完成后都能独立验收。严格遵守 `app → application → domain` 依赖方向，模块间仅通过 `index.ts` 公开契约交互。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可与同阶段其他标记任务并行，目标文件不同且不依赖未完成任务
- **[Story]**: 对应 spec.md 中的用户故事
- 所有任务均包含明确文件路径

## Phase 1: Setup（共享基础设施）

**Purpose**: 初始化 Next.js + TypeScript + Supabase 项目、目录和质量工具。

- [X] T001 使用 Next.js 16 App Router、TypeScript strict 和 `src/` 目录初始化项目，生成 package.json、next.config.ts、tsconfig.json、src/app/layout.tsx、src/app/page.tsx
- [X] T002 安装并锁定运行依赖与开发依赖，添加 pnpm-lock.yaml，并在 package.json 配置 dev、build、start、typecheck、format、lint、test、db、e2e、performance 脚本
- [X] T003 [P] 配置 ESLint、Prettier、模块路径别名和模块边界规则到 eslint.config.mjs、.prettierrc.json、tsconfig.json
- [X] T004 [P] 配置 Vitest、Testing Library、覆盖率阈值和测试初始化到 vitest.config.ts、tests/setup/vitest.setup.ts
- [X] T005 [P] 配置 Playwright 桌面浏览器项目、axe 支持和 Web Server 到 playwright.config.ts、tests/setup/playwright.fixture.ts
- [X] T006 初始化 Supabase 本地项目与迁移目录到 supabase/config.toml、supabase/migrations/.gitkeep、supabase/seed.sql、supabase/tests/.gitkeep
- [X] T007 [P] 创建模块化单体目录和公开入口到 src/modules/applications/index.ts、src/modules/analytics/index.ts、src/modules/data-transfer/index.ts、src/shared/index.ts
- [X] T008 [P] 创建安全环境变量模板和运行时校验到 .env.example、src/shared/config/env.ts，并扩充 .gitignore 排除 Supabase 临时状态与本地环境文件
- [X] T009 [P] 配置持续集成质量门禁到 .github/workflows/ci.yml，依次运行格式、lint、类型、覆盖率、数据库/契约、E2E/可访问性和性能烟测

**Checkpoint**: 项目可以安装、构建并启动空壳页面；本地 Supabase 可初始化；所有质量命令存在。

---

## Phase 2: Foundational（阻塞性前置）

**Purpose**: 建立所有用户故事共同依赖的数据库、安全边界、错误、日期和 UI 基础。

**⚠️ CRITICAL**: 本阶段完成前不得开始任何用户故事实现。

- [X] T010 编写基础数据库迁移，启用 pg_trgm、定义枚举、applications、application_stage_occurrences、application_events 及索引/权限到 supabase/migrations/20260813000100_core_applications.sql
- [X] T011 编写导入批次与导入行表、约束、索引和权限迁移到 supabase/migrations/20260813000200_import_batches.sql
- [X] T012 [P] 为表约束、级联删除、角色权限和索引编写失败优先的 pgTAP 测试到 supabase/tests/001_schema_test.sql
- [X] T013 实现 create_application、update_application、add/remove_stage_occurrence 事务函数及事件原子写入到 supabase/migrations/20260813000300_application_functions.sql
- [X] T014 [P] 为数据库函数原子性、乐观锁冲突、事件完整性和日期边界编写失败优先的 pgTAP 测试到 supabase/tests/002_application_functions_test.sql
- [X] T015 生成并提交数据库类型到 src/generated/database.types.ts，并在 package.json 添加可重复的 db:types 与类型漂移检查脚本
- [X] T016 [P] 实现仅服务端 Supabase 客户端及浏览器导入防护到 src/shared/database/supabase.server.ts、src/shared/database/index.ts
- [X] T017 [P] 实现统一 Problem 错误模型、请求关联 ID、隐私安全日志和 Route Handler 响应映射到 src/shared/errors/problem.ts、src/shared/observability/logger.ts、src/shared/http/problem-response.ts
- [X] T018 [P] 实现 Asia/Shanghai 业务日期、自然日差、分页游标值对象及单元测试到 src/shared/date/business-date.ts、src/shared/pagination/cursor.ts、tests/unit/shared/date-and-cursor.test.ts
- [X] T019 [P] 建立共享设计 tokens、全局样式、按钮、输入、状态反馈和可访问对话框到 src/app/globals.css、src/shared/ui/button.tsx、src/shared/ui/form-field.tsx、src/shared/ui/feedback.tsx、src/shared/ui/dialog.tsx
- [X] T020 [P] 实现应用 shell、全局导航、loading/error/not-found 状态和中文元数据到 src/app/layout.tsx、src/app/loading.tsx、src/app/error.tsx、src/app/not-found.tsx
- [X] T021 建立可重放开发 seed 与通用测试 fixture 到 supabase/seed.sql、tests/fixtures/applications.ts，并验证 `supabase db reset` 从空库成功

**Checkpoint**: 数据库迁移/函数测试通过，服务端可安全访问数据库，共享 UI 和错误协议可供所有故事使用。

---

## Phase 3: User Story 1 — 记录和维护投递信息（Priority: P1）🎯 MVP

**Goal**: 用户可以创建、查看、修改和确认删除投递，并完整追踪状态、阶段与详情变化。

**Independent Test**: 仅用公司、岗位和投递日期创建记录，补充详情、改变状态、添加多个阶段、查看历史，验证无效输入/并发冲突，取消及确认删除。

### Tests for User Story 1（先写并确认失败）

- [X] T022 [P] [US1] 为状态分类、字段/日期/URL 校验、阶段发生和事件差异规则编写领域单元测试到 tests/unit/applications/application-domain.test.ts
- [X] T023 [P] [US1] 为 POST/GET/PATCH/DELETE `/api/applications` 契约、Problem 错误和 409 乐观锁编写契约测试到 tests/contract/applications.contract.test.ts
- [X] T024 [P] [US1] 为创建/更新/阶段/删除跨数据库旅程和历史完整性编写集成测试到 tests/integration/applications/application-lifecycle.test.ts
- [X] T025 [P] [US1] 为表单字段错误、输入保留、删除对话框焦点和状态反馈编写组件测试到 tests/component/applications/application-form.test.tsx、tests/component/applications/delete-dialog.test.tsx
- [X] T026 [P] [US1] 为新增、编辑历史、并发冲突、取消/确认删除编写端到端测试到 tests/e2e/application-lifecycle.spec.ts

### Implementation for User Story 1

- [X] T027 [P] [US1] 实现状态/阶段常量、中文标签、Application 聚合值对象和验证 schema 到 src/modules/applications/domain/application.ts、src/modules/applications/domain/catalog.ts、src/modules/applications/domain/application.schema.ts
- [X] T028 [P] [US1] 实现投递 DTO、命令/查询端口和应用错误契约到 src/modules/applications/application/contracts.ts、src/modules/applications/application/ports.ts
- [X] T029 [US1] 实现 Supabase 投递仓储与数据库函数适配到 src/modules/applications/infrastructure/supabase-application-repository.ts
- [X] T030 [US1] 实现 create/get/update/delete 及阶段变更应用服务并从公开入口导出到 src/modules/applications/application/application-service.ts、src/modules/applications/index.ts
- [X] T031 [P] [US1] 实现同源创建/编辑 Server Actions、字段错误映射和缓存刷新到 src/app/(dashboard)/applications/actions.ts
- [X] T032 [P] [US1] 实现 OpenAPI 对应的创建/详情/更新/删除 Route Handlers 到 src/app/api/applications/route.ts、src/app/api/applications/[id]/route.ts
- [X] T033 [P] [US1] 实现共享投递表单、状态选择、阶段编辑和错误摘要到 src/modules/applications/ui/application-form.tsx、src/modules/applications/ui/stage-editor.tsx
- [X] T034 [US1] 实现新增页面及成功/失败导航反馈到 src/app/(dashboard)/applications/new/page.tsx、src/app/(dashboard)/applications/new/loading.tsx
- [X] T035 [US1] 实现详情、时间线、编辑与具名删除确认到 src/app/(dashboard)/applications/[id]/page.tsx、src/modules/applications/ui/application-history.tsx、src/modules/applications/ui/delete-application-dialog.tsx
- [X] T036 [US1] 运行 US1 单元、契约、集成、组件、E2E 与 axe 测试并修复到全部通过，记录验收结果到 specs/001-resume-application-tracking/quickstart.md

**Checkpoint**: User Story 1 独立可用，构成首个可演示 MVP。

---

## Phase 4: User Story 2 — 查找和组织投递记录（Priority: P1）

**Goal**: 用户可以从主列表搜索、组合筛选、稳定排序/分页和分组，并从列表进入详情。

**Independent Test**: 对包含多公司、岗位、城市、日期、状态和阶段的数据集组合操作，核对 URL、结果、默认活跃优先分组及清空条件行为。

### Tests for User Story 2（先写并确认失败）

- [X] T037 [P] [US2] 为查询参数解析、白名单排序、筛选组合、游标编码和默认分组编写单元测试到 tests/unit/applications/application-query.test.ts
- [X] T038 [P] [US2] 为 GET `/api/applications` 搜索筛选分页契约编写契约测试到 tests/contract/application-list.contract.test.ts
- [X] T039 [P] [US2] 为 trigram 部分匹配、组合筛选和跨页无重复/遗漏编写 10k 以内集成测试到 tests/integration/applications/application-list-query.test.ts
- [X] T040 [P] [US2] 为关键词、筛选、排序、空状态、清除条件和详情导航编写端到端测试到 tests/e2e/application-list.spec.ts

### Implementation for User Story 2

- [X] T041 [P] [US2] 实现 URL 查询 schema、游标和列表 DTO 到 src/modules/applications/application/list-query.ts
- [X] T042 [US2] 实现基于索引的服务端搜索、筛选、排序、活跃/结束分组和游标分页到 src/modules/applications/infrastructure/supabase-application-list.ts
- [X] T043 [US2] 将 listApplications 用例接入模块公开入口及 GET Route Handler 到 src/modules/applications/application/list-applications.ts、src/modules/applications/index.ts、src/app/api/applications/route.ts
- [X] T044 [P] [US2] 实现筛选栏、已选条件、排序控件、分组表格、分页和空状态到 src/modules/applications/ui/application-filters.tsx、src/modules/applications/ui/application-table.tsx、src/modules/applications/ui/application-list-empty.tsx
- [X] T045 [US2] 实现以 URL 为状态源的主列表页面并保留详情往返条件到 src/app/(dashboard)/page.tsx
- [X] T046 [US2] 运行 US2 单元、契约、集成、E2E 与键盘/窄桌面验收并修复到全部通过，记录结果到 specs/001-resume-application-tracking/quickstart.md

**Checkpoint**: User Stories 1 和 2 均可独立验证；核心记录管理产品完整可用。

---

## Phase 5: User Story 3 — 掌握整体求职进展（Priority: P2）

**Goal**: 用户可以查看准确的核心统计、阶段分布和连续 7 天未更新的跟进提示。

**Independent Test**: 使用覆盖周一边界、全部状态/阶段和 6/7 天阈值的固定数据，核对统计和提醒，并在更新后确认提醒消失。

### Tests for User Story 3（先写并确认失败）

- [X] T047 [P] [US3] 为本周区间、结束状态、去重阶段分布和 7 天跟进判定编写单元测试到 tests/unit/analytics/analytics-rules.test.ts
- [X] T048 [P] [US3] 为统计聚合、时区边界和更新后提醒移除编写数据库集成测试到 tests/integration/analytics/analytics-summary.test.ts
- [X] T049 [P] [US3] 为 GET `/api/analytics/summary` 编写契约测试到 tests/contract/analytics-summary.contract.test.ts
- [X] T050 [P] [US3] 为统计卡、文本阶段分布和跟进导航编写端到端/可访问性测试到 tests/e2e/analytics.spec.ts

### Implementation for User Story 3

- [X] T051 [P] [US3] 定义 AnalyticsSummary、StageDistribution、FollowUp DTO 与应用端口到 src/modules/analytics/application/contracts.ts、src/modules/analytics/application/ports.ts
- [X] T052 [US3] 添加单查询统计/跟进数据库函数及索引验证到 supabase/migrations/20260813000400_analytics_summary.sql、supabase/tests/003_analytics_test.sql
- [X] T053 [US3] 实现统计适配器、应用服务和公开入口到 src/modules/analytics/infrastructure/supabase-analytics.ts、src/modules/analytics/application/get-summary.ts、src/modules/analytics/index.ts
- [X] T054 [P] [US3] 实现统计 Route Handler 和不可缓存的业务日期处理到 src/app/api/analytics/summary/route.ts
- [X] T055 [P] [US3] 实现统计卡、阶段分布和跟进列表组件到 src/modules/analytics/ui/summary-cards.tsx、src/modules/analytics/ui/stage-distribution.tsx、src/modules/analytics/ui/follow-up-list.tsx
- [X] T056 [US3] 将统计和提醒组合到主页面的 loading/empty/error 状态并运行 US3 全套验收到 src/app/(dashboard)/page.tsx、src/modules/analytics/ui/analytics-panel.tsx

**Checkpoint**: 统计和跟进信息准确，且不影响 US1/US2 的独立运行。

---

## Phase 6: User Story 4 — 导入和导出投递数据（Priority: P2）

**Goal**: 用户可以预检 CSV/XLSX、逐行处理错误与重复候选、确认部分成功导入，并导出全部或筛选数据。

**Independent Test**: 使用混合有效/无效/重复文件完成预检和确认，核对汇总与数据库；导出全部和筛选结果并往返核对；验证大小/行数/损坏文件边界。

### Tests for User Story 4（先写并确认失败）

- [X] T057 [P] [US4] 为列映射、行归一化、字段错误、重复键和过期批次规则编写单元测试到 tests/unit/data-transfer/import-rules.test.ts
- [X] T058 [P] [US4] 为 preview/confirm/export OpenAPI、413/415、过期/冲突和部分成功结果编写契约测试到 tests/contract/data-transfer.contract.test.ts
- [X] T059 [P] [US4] 创建有效、无效、重复、损坏及边界 CSV/XLSX fixture 到 tests/fixtures/import/valid.csv、tests/fixtures/import/mixed.xlsx、tests/fixtures/import/corrupt.xlsx
- [X] T060 [P] [US4] 为批次持久化、逐行隔离、重复不覆盖、过期清理和往返导出编写集成测试到 tests/integration/data-transfer/import-export.test.ts
- [X] T061 [P] [US4] 为上传预检、重复决策、结果摘要及全部/筛选导出编写端到端测试到 tests/e2e/data-transfer.spec.ts

### Implementation for User Story 4

- [X] T062 [P] [US4] 定义导入列词典、行 schema、批次/结果 DTO、5MB/10k 限制和导出字段契约到 src/modules/data-transfer/application/contracts.ts、src/modules/data-transfer/application/import-schema.ts
- [X] T063 [P] [US4] 实现 CSV/XLSX 流程解析、标准化和工作簿生成适配器到 src/modules/data-transfer/infrastructure/spreadsheet-reader.ts、src/modules/data-transfer/infrastructure/spreadsheet-writer.ts
- [X] T064 [US4] 实现 PostgreSQL 批次仓储、24 小时惰性过期清理和重复候选查询到 src/modules/data-transfer/infrastructure/postgres-import-repository.ts
- [X] T065 [US4] 实现 previewImport、confirmImport、exportApplications 用例并通过 applications 公开批量命令写入到 src/modules/data-transfer/application/preview-import.ts、src/modules/data-transfer/application/confirm-import.ts、src/modules/data-transfer/application/export-applications.ts、src/modules/data-transfer/index.ts
- [X] T066 [P] [US4] 实现 5MB 文件上传预检和确认 Route Handlers 到 src/app/api/imports/preview/route.ts、src/app/api/imports/[id]/confirm/route.ts
- [X] T067 [P] [US4] 实现按全部/当前筛选范围流式下载 XLSX/CSV 的 Route Handler 到 src/app/api/exports/applications/route.ts
- [X] T068 [P] [US4] 实现上传器、列映射、逐行问题/重复决策和结果摘要组件到 src/modules/data-transfer/ui/import-uploader.tsx、src/modules/data-transfer/ui/import-preview.tsx、src/modules/data-transfer/ui/import-result.tsx
- [X] T069 [US4] 实现导入页面和主列表导出入口到 src/app/(dashboard)/import/page.tsx、src/modules/data-transfer/ui/export-button.tsx、src/app/(dashboard)/page.tsx
- [X] T070 [US4] 运行 US4 单元、契约、集成、E2E、键盘和文件边界测试并修复到全部通过，记录结果到 specs/001-resume-application-tracking/quickstart.md

**Checkpoint**: 四个用户故事全部可独立验收，首期业务范围完成。

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 收紧安全、性能、可访问性、文档和发布保障，不引入新的产品范围。

- [X] T071 [P] 添加 10,000 条确定性性能 seed 与列表/筛选/统计/CRUD p95 基准到 tests/performance/seed-10000.ts、tests/performance/application-performance.test.ts
- [X] T072 [P] 添加 Core Web Vitals/Lighthouse 预算和桌面视口配置到 lighthouserc.json、tests/performance/web-vitals.spec.ts
- [X] T073 [P] 对所有关键页面运行 axe 和人工键盘/焦点/颜色/1280px 窄桌面审查，补充回归测试到 tests/e2e/accessibility.spec.ts
- [X] T074 [P] 添加服务健康检查、请求耗时与隐私日志验证到 src/app/api/health/route.ts、tests/integration/observability/health-and-logging.test.ts
- [X] T075 审查数据库权限、服务端密钥泄露、文件类型伪造、公式注入和错误信息泄漏，并在 src/modules/data-transfer/infrastructure/spreadsheet-writer.ts、src/shared/config/env.ts、supabase/tests/001_schema_test.sql 加固
- [X] T076 执行依赖边界重构、去重、死代码清理和公开模块 API 审查到 src/modules/applications/index.ts、src/modules/analytics/index.ts、src/modules/data-transfer/index.ts、src/shared/index.ts
- [X] T077 [P] 更新项目安装、环境变量、本地 Supabase、迁移、测试、构建和部署/回滚说明到 README.md、docs/architecture.md、docs/operations.md
- [X] T078 依照 specs/001-resume-application-tracking/quickstart.md 完整执行格式、lint、类型、覆盖率、数据库、契约、E2E、可访问性和性能门禁，并把最终证据记录到 specs/001-resume-application-tracking/validation-report.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: 无依赖，立即开始。
- **Phase 2 Foundational**: 依赖 Phase 1，完成前阻塞全部故事。
- **Phase 3 US1**: 依赖 Phase 2；首个 MVP。
- **Phase 4 US2**: 依赖 Phase 2 的查询基础和 US1 的投递公开 DTO/详情导航；建议在 US1 完成后实施。
- **Phase 5 US3**: 依赖 Phase 2 的 schema 和 applications 只读契约；可在 US1 核心数据能力完成后与 US2 并行。
- **Phase 6 US4**: 依赖 Phase 2 的批次表和 US1 的批量创建公开命令；可在 US1 完成后与 US2/US3 并行。
- **Phase 7 Polish**: 依赖所有拟发布故事完成。

### User Story Dependency Graph

```text
Setup → Foundation → US1 (MVP)
                         ├──→ US2 ──┐
                         ├──→ US3 ──┼──→ Polish/Release
                         └──→ US4 ──┘
```

### Within Each User Story

1. 测试任务先完成并确认失败。
2. 领域 schema/DTO/端口先于仓储和应用服务。
3. 应用服务先于 Route Handler/Server Action。
4. 服务端能力和 UI 组件可在契约稳定后并行。
5. 集成页面后执行该故事全部测试与独立验收。

## Parallel Opportunities

- Setup 中 T003–T005、T007–T009 可按文件并行。
- Foundation 中 T012、T014、T016–T020 可在相应迁移/契约就绪后并行。
- 每个故事的测试文件均可并行编写；实现必须等待这些测试确认失败。
- US1 完成公开数据命令/查询契约后，US2、US3、US4 可由不同开发者并行。
- 每个故事中标有 [P] 的 Route Handler、UI 组件和独立适配器可并行。
- Polish 中性能、Web Vitals、可访问性、可观测性和文档可并行。

## Parallel Examples

### User Story 1

```text
T022 领域规则测试 | T023 契约测试 | T024 数据库旅程 | T025 组件测试 | T026 E2E
测试失败后：T027 领域模型 | T028 应用契约
服务稳定后：T031 Server Actions | T032 Route Handlers | T033 UI 组件
```

### User Story 2

```text
T037 查询单元测试 | T038 契约测试 | T039 查询集成测试 | T040 E2E
服务稳定后：T044 列表组件（与 T043 HTTP 接入并行）
```

### User Story 3

```text
T047 规则测试 | T048 聚合集成测试 | T049 契约测试 | T050 E2E
数据服务稳定后：T054 Route Handler | T055 统计 UI
```

### User Story 4

```text
T057 规则测试 | T058 契约测试 | T059 文件 fixture | T060 集成测试 | T061 E2E
契约稳定后：T063 文件适配器 | T066 导入 HTTP | T067 导出 HTTP | T068 导入 UI
```

## Implementation Strategy

### MVP First

1. 完成 Phase 1 Setup。
2. 完成 Phase 2 Foundation，并通过数据库/安全基础测试。
3. 完成 Phase 3 US1。
4. 停止扩展，独立执行 US1 验收；此时即可演示记录、更新、历史和删除。

### Incremental Delivery

1. US1：可靠保存并回顾投递记录。
2. US2：让增长后的记录可查找和组织，形成核心产品。
3. US3：增加统计和行动提醒。
4. US4：降低迁移成本并提供数据可携带性。
5. Polish：以宪章门禁完成发布候选验证。

### Definition of Done per Task Group

- 代码已格式化、lint 与类型检查通过。
- 相关测试先失败后通过，且未削弱断言；变更代码行/分支覆盖率均 ≥80%。
- UI 具有 loading、empty、success、validation、failure 状态，并完成键盘/焦点检查。
- 公开契约、数据库迁移与生成类型保持一致。
- 不记录或暴露 notes、文件内容、职位 URL 参数和服务端密钥。

## Notes

- `[P]` 仅表示文件和依赖允许并行，不表示可跳过前置阶段。
- 数据库迁移文件名为规划基线；若实际生成时间戳不同，保持顺序和语义不变。
- 每个逻辑任务或紧密任务组完成后提交，避免跨故事混合提交。
- 不在本清单中加入账号、多人协作、邮件解析、招聘网站同步、消息通知或智能分析。
