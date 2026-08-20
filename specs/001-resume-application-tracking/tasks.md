# Tasks: 职迹简历投递管理

> 实现对账说明（2026-08-21）：本文件保留任务执行历史；当前代码已从早期 Supabase 客户端/Server Actions 方案收敛为自有 PostgreSQL、Better Auth 和同源 Route Handlers。运行时事实以 `src/`、`supabase/migrations/`、OpenAPI 契约及 `docs/architecture.md` 为准。

**Input**: Design documents from `/specs/001-resume-application-tracking/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md

**Tests**: 项目宪章要求测试作为发布门禁。每个故事的测试任务必须先完成并确认失败，再开始对应实现。

**Organization**: 任务按用户故事分组；每个故事完成后都能独立验收。严格遵守 `app → application → domain` 依赖方向，模块间仅通过 `index.ts` 公开契约交互。

**Scope Extension Baseline**: T001–T078 是已完成的原单用户系统基线。2026-08-13 新增的注册、登录、管理员/普通用户分流与 owner 隔离从 T079 开始；保留已完成标记以避免重做历史工作。

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

**Goal**: 用户可以查看准确的核心统计、阶段分布和连续 15 天未更新的跟进提示。

**Independent Test**: 使用覆盖周一边界、三种状态、全部阶段和 14/15 天阈值的固定数据，核对统计和提醒，并在更新后确认提醒消失。

### Tests for User Story 3（先写并确认失败）

- [X] T047 [P] [US3] 为本周区间、终态、去重阶段分布和 15 天跟进判定编写单元测试到 tests/unit/analytics/analytics-rules.test.ts
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

## Phase 8: Authentication Setup（账号范围扩展准备）

**Purpose**: 在不破坏已完成业务能力的前提下，引入 Supabase Auth SSR 依赖、配置和 identity-access 模块边界。

- [X] T079 安装并锁定 Better Auth 与 PostgreSQL 驱动到 package.json、pnpm-lock.yaml
- [X] T080 [P] 扩展 DATABASE_URL、BETTER_AUTH_SECRET、BETTER_AUTH_URL 的服务端环境校验到 .env.example、src/shared/config/env.ts
- [X] T081 [P] 配置本地邮箱密码注册、确认回调、允许跳转 URL 和 Mailpit 到 supabase/config.toml
- [X] T082 [P] 建立 identity-access 模块公开边界和目录到 src/modules/identity-access/index.ts、src/modules/identity-access/application/.gitkeep、src/modules/identity-access/infrastructure/.gitkeep、src/modules/identity-access/ui/.gitkeep
- [X] T083 [P] 更新依赖边界规则，禁止客户端 UI 导入服务端数据库与基础设施适配器到 eslint.config.mjs、tests/unit/shared/module-boundaries.test.ts

**Checkpoint**: 认证依赖和配置可被构建/测试环境加载，尚不改变现有用户访问行为。

---

## Phase 9: Authentication Foundation（阻塞性账号与归属基础）

**Purpose**: 建立 profile、角色、owner、审计、会话和纵深授权基础；完成前不得开放注册入口。

**⚠️ CRITICAL**: T084–T096 完成并验证前，公开部署不得启用多用户注册。

- [X] T084 [P] 为 users 默认普通角色、最后管理员保护、owner FK/NOT NULL、原子 owner 函数和审计不可篡改编写数据库测试到 supabase/tests/004_identity_access_test.sql
- [X] T085 [P] 为缺失/无效 MIGRATION_OWNER_ID、遗留数据及成功回填编写迁移演练测试到 scripts/test_owner_migration.py
- [X] T086 创建 account_role、profiles、admin_audit_events、注册 profile 触发器和最后管理员保护函数到 supabase/migrations/20260813000600_identity_access.sql
- [X] T087 添加 applications/import_batches 的可空 owner_id、显式 owner 回填、FK/NOT NULL/索引及失败保护到 supabase/migrations/20260813000700_owner_backfill.sql
- [X] T088 添加 applications、阶段、事件、导入批次/行的 authenticated owner RLS 与管理员授权函数到 supabase/migrations/20260813000800_owner_rls.sql
- [X] T089 改造数据库 RPC 以从 `auth.uid()`/可信 actor 写入并校验 owner，禁止 payload 指定 owner 到 supabase/migrations/20260813000900_owner_aware_functions.sql
- [X] T090 重新生成包含 Better Auth users/session/account、role、owner 与审计表的数据库类型并验证漂移到 src/generated/database.types.ts、package.json
- [X] T091 [P] 实现 Better Auth PostgreSQL、Server Component/Action Cookie 会话适配到 src/modules/identity-access/infrastructure/better-auth.server.ts
- [X] T092 [P] 定义 Actor、AccountRole、Profile、会话错误与注册/登录 schema 到 src/modules/identity-access/application/contracts.ts、src/modules/identity-access/application/auth-schema.ts
- [X] T093 实现 `getActor`、`requireUser`、`requireAdmin`、禁用状态校验及可信 returnTo 白名单到 src/modules/identity-access/application/authorization.ts
- [X] T094 实现 profile/角色/账号状态仓储和管理员审计事务到 src/modules/identity-access/infrastructure/postgres-profile-repository.ts、src/modules/identity-access/infrastructure/supabase-admin-repository.ts
- [X] T095 从 identity-access 公开导出最小授权接口，并禁止其他模块读取内部 profile 表到 src/modules/identity-access/index.ts
- [X] T096 实现 Next.js 16 Cookie 刷新与乐观页面分流到 src/proxy.ts，并确保最终授权仍由 T093 的 DAL 检查承担

**Checkpoint**: owner 迁移可安全重放，普通用户数据库策略严格隔离，会话和角色授权可供所有故事调用。

---

## Phase 10: User Story 0 — 注册、登录与角色分流（Priority: P0）🎯 Authentication MVP

**Goal**: 访客可注册普通账号；普通用户登录进入业务首页；管理员登录进入 `/admin`；退出、确认、恢复和越权拒绝均可用。

**Independent Test**: 使用访客、普通用户、管理员和禁用用户分别访问认证页、普通页面、`/admin` 和认证/管理 API，验证角色分流、401/403、最后管理员保护及退出后失效。

### Tests for User Story 0（先写并确认失败）

- [X] T097 [P] [US0] 为注册/登录校验、returnTo 白名单、角色分流和统一凭据错误编写单元测试到 tests/unit/identity-access/auth-rules.test.ts
- [X] T098 [P] [US0] 为 `/api/auth/register|login|logout` 与 `/api/admin/users` 的 202/401/403/409/429 契约编写测试到 tests/contract/identity-access.contract.test.ts
- [X] T099 [P] [US0] 为 users 默认角色、角色/禁用审计和最后管理员保护编写集成测试到 tests/integration/identity-access/account-lifecycle.test.ts
- [X] T100 [P] [US0] 为登录、注册和账号管理表单的 pending/error/focus/密码管理器语义编写组件测试到 tests/component/identity-access/auth-forms.test.tsx、tests/component/identity-access/user-admin-table.test.tsx
- [X] T101 [P] [US0] 为用户名注册、普通用户登录分流、退出和越权访问编写 E2E 到 tests/e2e/authentication-and-rbac.spec.ts

### Implementation for User Story 0

- [X] T102 [US0] 实现注册、登录、退出、确认交换、密码恢复和会话撤销用例到 src/modules/identity-access/application/auth-service.ts
- [X] T103 [US0] 实现分页用户查询、角色变更、启用/禁用及最后管理员冲突映射到 src/modules/identity-access/application/admin-user-service.ts
- [X] T104 [P] [US0] 实现注册、登录、退出与密码恢复 Server Actions 到 src/app/(auth)/actions.ts
- [X] T105 [P] [US0] 实现 OpenAPI 认证 Route Handlers、同源校验和统一限流/CAPTCHA 接入点到认证 routes 与 identity-access infrastructure
- [X] T106 [P] [US0] 为未配置 SMTP 的密码恢复实现不枚举账号的受控提示与 503 安全回退到 auth-service.ts 和恢复页面
- [X] T107 [P] [US0] 实现可访问的登录、注册、忘记/重置密码表单与反馈状态到 src/modules/identity-access/ui/login-form.tsx、src/modules/identity-access/ui/register-form.tsx、src/modules/identity-access/ui/password-reset-form.tsx
- [X] T108 [US0] 实现公开认证页面及已登录角色重定向到 src/app/(auth)/login/page.tsx、src/app/(auth)/register/page.tsx、src/app/(auth)/forgot-password/page.tsx、src/app/(auth)/reset-password/page.tsx
- [X] T109 [P] [US0] 实现管理员用户分页、角色/状态操作、具名确认、错误反馈和全局摘要组件到 identity-access UI
- [X] T110 [US0] 实现受保护的管理员页面与用户管理 Route Handlers 到 src/app/admin/page.tsx、src/app/api/admin/users/route.ts、src/app/api/admin/users/[id]/route.ts
- [X] T111 [US0] 在全局 shell 增加角色感知导航、当前用户信息与退出入口到 src/app/layout.tsx、src/modules/identity-access/ui/account-menu.tsx
- [X] T112 [US0] 运行 US0 单元、契约、集成、组件、E2E 与 axe 测试并记录独立验收到 quickstart.md

**Checkpoint**: 认证 MVP 可独立发布；角色由服务端可信数据决定，普通用户无法进入管理后台。

---

## Phase 11: User Story 1 Owner Extension — 投递生命周期隔离（Priority: P1）

**Goal**: 所有投递详情和写操作绑定当前 actor，跨用户 UUID 不可读取或修改。

**Independent Test**: 用户 A 创建投递后，用户 B 对其详情、更新、阶段和删除请求均得到不泄露存在性的拒绝；A 的完整生命周期保持可用。

- [X] T113 [P] [US1] 为双用户投递 CRUD、阶段原子函数和跨 owner UUID 拒绝编写真实数据库集成测试到 tests/integration/applications/application-owner-isolation.test.ts
- [X] T114 [P] [US1] 为未登录拒绝、跨 owner 404 和普通用户全局摘要拒绝补充契约测试到 tests/contract/applications-auth.contract.test.ts
- [X] T115 [US1] 将 Actor/owner 条件贯穿投递端口、服务和 PostgreSQL 仓储到 src/modules/applications/application/ports.ts、src/modules/applications/application/application-service.ts、src/modules/applications/infrastructure/postgres-application-repository.ts
- [X] T116 [US1] 在投递 Server Actions、详情及阶段 Route Handlers 调用 requireUser 并移除无身份数据库路径到 src/app/applications/actions.ts、src/app/api/applications/[id]/route.ts、src/app/api/applications/[id]/stages/route.ts、src/app/api/applications/[id]/stages/[occurrenceId]/route.ts

**Checkpoint**: US1 在多用户环境中独立满足 owner 隔离。

---

## Phase 12: User Story 2 Owner Extension — 列表与搜索隔离（Priority: P1）

**Goal**: 搜索、筛选、排序、分页和详情导航只在当前普通用户的数据集合内运行。

**Independent Test**: 两个用户使用可区分 fixture 执行所有列表组合，结果、游标和数量均不包含另一用户记录。

- [X] T117 [P] [US2] 为双用户搜索、筛选、排序和跨页游标隔离编写真实数据库集成/E2E 测试到 applications isolation tests
- [X] T118 [US2] 将 owner 谓词加入列表端口、查询实现及 API actor 校验到 src/modules/applications/application/list-query.ts、src/modules/applications/infrastructure/postgres-application-repository.ts、src/app/api/applications/route.ts
- [X] T119 [US2] 保护主列表 Server Component 并按会话 actor 获取数据到 src/app/page.tsx

**Checkpoint**: US2 所有查询和游标都局限于当前 owner。

---

## Phase 13: User Story 3 Owner Extension — 统计与跟进隔离（Priority: P2）

**Goal**: 普通用户只看到自己的统计和提醒；管理员全局摘要仅在专用后台用例中提供。

**Independent Test**: A/B 数据集的普通统计分别准确，管理员普通首页不聚合全局数据，`/admin` 专用摘要才显示全局总量。

- [X] T120 [P] [US3] 为用户级统计、跟进和管理员专用全局摘要编写真实数据库/契约测试到 analytics isolation tests
- [X] T121 [US3] 将 actor/owner 参数加入统计端口、PostgreSQL 查询适配器和普通统计 Route Handler，所有统计直接按 owner 谓词聚合
- [X] T122 [US3] 实现 requireAdmin 保护的全局运营摘要用例与接口到 src/modules/identity-access/application/admin-summary-service.ts、src/app/api/admin/summary/route.ts

**Checkpoint**: US3 普通统计无跨用户混入，管理员全局能力与普通路径明确分离。

---

## Phase 14: User Story 4 Owner Extension — 导入导出隔离（Priority: P2）

**Goal**: 导入批次、重复检测、确认和导出全部绑定当前 owner。

**Independent Test**: 用户 A 无法预览/确认用户 B 的批次，重复候选仅比较本人记录，双方导出文件无交叉数据。

- [X] T123 [P] [US4] 为跨用户批次访问、owner 内重复检测和导出隔离编写真实数据库集成/E2E 测试到 data-transfer isolation tests
- [X] T124 [US4] 将 actor/owner 贯穿预检、确认、重复查询和导出应用服务/仓储到 src/modules/data-transfer/application/preview-import.ts、src/modules/data-transfer/application/confirm-import.ts、src/modules/data-transfer/application/export-applications.ts、src/modules/data-transfer/infrastructure/postgres-import-repository.ts
- [X] T125 [US4] 保护导入预览、确认和导出 Route Handlers 并对跨 owner 资源返回统一拒绝到 src/app/api/imports/preview/route.ts、src/app/api/imports/[id]/confirm/route.ts、src/app/api/exports/applications/route.ts

**Checkpoint**: US4 的批次、重复判断和文件内容全部按 owner 隔离。

---

## Phase 15: Authentication Polish & Release Gates

**Purpose**: 完成安全、性能、可访问性、迁移、文档与整体验证，不扩大产品范围。

- [X] T126 [P] 对凭据枚举、开放重定向、CSRF、速率限制、服务端边界和日志 token 泄露编写安全回归测试到 identity-access security tests
- [X] T127 [P] 验证登录/角色分流 p95 ≤1s 及 owner 条件下 10k/用户列表统计预算到 performance tests
- [X] T128 [P] 对认证页、账号菜单执行 WCAG 2.2 AA、键盘、焦点、窄桌面检查到 accessibility.spec.ts
- [X] T129 [P] 更新认证配置、SMTP/CAPTCHA、首个管理员引导、owner 迁移、禁用账号与应急回滚说明到 README.md、docs/architecture.md、docs/operations.md
- [X] T130 校验 contracts/openapi.yaml、实际认证/管理路由、Problem 响应与生成数据库类型一致到 identity-access contracts
- [X] T131 执行 owner 迁移演练、格式、lint、类型、覆盖率、数据库、契约、E2E、可访问性和性能全门禁并记录证据到 validation-report.md

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
- **Phase 8 Authentication Setup**: 依赖已完成的 T001–T078 基线，可立即开始账号范围扩展。
- **Phase 9 Authentication Foundation**: 依赖 Phase 8，完成前阻塞注册开放和所有 owner 改造。
- **Phase 10 US0**: 依赖 Phase 9，构成认证 MVP。
- **Phases 11–14 Owner Extensions**: 依赖 US0 的 actor/授权接口；US1 完成后 US2/US3/US4 可并行。
- **Phase 15 Authentication Polish**: 依赖 US0 与全部拟发布 owner extension 完成。

### User Story Dependency Graph

```text
Setup → Foundation → US1 (MVP)
                         ├──→ US2 ──┐
                         ├──→ US3 ──┼──→ Polish/Release
                         └──→ US4 ──┘
```

```text
Completed Baseline T001–T078 → Auth Setup → Auth Foundation → US0 (Authentication MVP)
                                                              └──→ US1 owner isolation
                                                                    ├──→ US2 list isolation ──┐
                                                                    ├──→ US3 analytics ───────┼──→ Auth Polish/Release
                                                                    └──→ US4 transfer ────────┘
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
- 账号扩展中 T080–T083、T084–T085、T091–T092 可按文件并行；迁移必须保持 T086→T087→T088→T089 顺序。
- US0 测试 T097–T101 可并行，失败确认后认证 API、UI 与管理员组件 T104–T109 可按依赖并行。
- US1 owner 隔离完成后，US2、US3、US4 的 owner 改造可以由不同执行者并行。
- Phase 15 中安全、性能、可访问性和文档 T126–T129 可并行。

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

### User Story 0

```text
T097 认证规则 | T098 HTTP 契约 | T099 账号生命周期 | T100 组件 | T101 E2E
服务契约稳定后：T104 Actions | T105 Auth API | T106 回调 | T107 表单 | T109 管理 UI
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

### Authentication Scope Extension MVP

1. 以已完成的 T001–T078 为基线完成 Phase 8。
2. 完成 Phase 9，安全迁移旧数据并建立 owner/RLS。
3. 完成 Phase 10 US0，独立验证注册、登录、角色分流和管理后台。
4. 完成 Phase 11，确保核心投递生命周期无跨用户访问后才允许公开多用户部署。
5. 按 US2→US3→US4 增量恢复列表、统计和导入导出能力，最后执行 Phase 15。

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
- 本次范围包含账号、管理员/普通用户角色与 owner 隔离；仍不包含组织/团队协作、社交登录、邮件解析、招聘网站同步、消息通知或智能分析。
