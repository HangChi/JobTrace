---

description: "面试面经记录与复盘的依赖顺序实施任务"
---

# Tasks: 面试面经记录与复盘

> 实现对账说明（2026-08-21）：性能种子必须与基准处于同一事务并在结束后回滚；当前运行方式以 `package.json`、`tests/performance/` 和 `docs/operations.md` 为准。

**Input**: Design documents from `/specs/002-interview-review/`

**Prerequisites**: plan.md、spec.md、research.md、data-model.md、contracts/openapi.yaml、quickstart.md

**Tests**: 项目宪章要求所有行为变更具备自动化测试。每个故事先写会失败的测试，再实现对应行为；变更代码行覆盖率和分支覆盖率均不得低于 80%。

**Organization**: 任务按用户故事分组；Setup 和 Foundational 完成后，故事任务可按依赖关系独立交付和验证。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可在不同文件上并行执行，且不依赖同阶段未完成任务
- **[Story]**: 对应 spec.md 中的用户故事
- 每个任务均包含明确文件路径

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 建立面经模块、测试夹具和公开边界，不改变业务行为。

- [X] T001 创建 interviews 模块目录和最小公开 barrel 文件 `src/modules/interviews/index.ts`
- [X] T002 [P] 创建面经测试对象构造器和固定日期夹具 `tests/fixtures/interviews.ts`
- [X] T003 [P] 将 interviews 模块加入跨模块依赖边界测试 `tests/unit/shared/module-boundaries.test.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 建立所有故事共用的数据结构、领域规则、契约类型和数据库边界。

**CRITICAL**: 本阶段完成前不得开始用户故事实现。

- [X] T004 [P] 先为面试阶段白名单、文本/日期/时长/评分边界、完成条件和状态转换编写失败单元测试 `tests/unit/interviews/interview-domain.test.ts`
- [X] T005 [P] 先为枚举、表、FK、唯一阶段关联、排序约束和级联/SET NULL 语义编写失败 schema 测试 `supabase/tests/005_interview_reviews_test.sql`
- [X] T006 实现面经枚举、中文标签和可记录阶段白名单 `src/modules/interviews/domain/catalog.ts`
- [X] T007 实现创建、聚合更新、问题、行动项和列表查询的 Zod schema `src/modules/interviews/domain/interview.schema.ts`
- [X] T008 实现复盘完成判定、文本归一化和排序不变量 `src/modules/interviews/domain/interview.ts`
- [X] T009 创建面经、问题、行动项表、索引、owner 约束和基础原子函数迁移 `supabase/migrations/20260818000200_interview_reviews.sql`
- [X] T010 运行数据库类型生成并提交面经 schema 类型更新 `src/generated/database.types.ts`
- [X] T011 [P] 定义 InterviewSummary、InterviewDetail、InterviewPage 和 StageInterviewSummary DTO `src/modules/interviews/application/contracts.ts`
- [X] T012 定义创建、读取、更新、删除、列表和投递摘要仓储端口 `src/modules/interviews/application/ports.ts`

**Checkpoint**: 数据与领域基础已就绪，用户故事可以开始实施。

---

## Phase 3: User Story 1 - 关联阶段记录面经 (Priority: P1) MVP Part 1

**Goal**: 用户可从具体阶段或面经入口创建唯一关联的面经；缺少阶段时可原子补录阶段并创建面经。

**Independent Test**: 为同一投递的一面和二面分别创建面经，确认轮次/日期正确且互不覆盖；重复点击已有阶段入口打开原面经；从面经入口补录阶段时不产生孤立记录。

### Tests for User Story 1

- [X] T013 [P] [US1] 先编写 POST/GET 面经成功、校验、404 和重复关联 409 契约测试 `tests/contract/interview-review.contract.test.ts`
- [X] T014 [P] [US1] 先编写已有阶段创建、新阶段+面经原子创建、重复 occurrence 和事务回滚集成测试 `tests/integration/interviews/interview-creation.test.ts`
- [X] T015 [P] [US1] 先编写阶段时间线“记录面经/继续复盘”和创建表单预填组件测试 `tests/component/interviews/interview-create-flow.test.tsx`

### Implementation for User Story 1

- [X] T016 [US1] 实现面经行映射、按 owner 读取、已有阶段创建和新阶段原子创建 `src/modules/interviews/infrastructure/postgres-interview-repository.ts`
- [X] T017 [US1] 实现 requireUser、输入校验、重复入口返回已有面经和错误映射 `src/modules/interviews/application/interview-service.ts`
- [X] T018 [US1] 导出创建、读取和投递阶段面经摘要服务 `src/modules/interviews/index.ts`
- [X] T019 [US1] 实现 POST `/api/interviews` 与 GET 列表入口的创建分支 `src/app/api/interviews/route.ts`
- [X] T020 [US1] 实现 GET `/api/interviews/{id}` Route Handler `src/app/api/interviews/[id]/route.ts`
- [X] T021 [US1] 实现选择投递/已有阶段或补录阶段的新建面经页面 `src/app/interviews/new/page.tsx`
- [X] T022 [US1] 在招聘阶段时间线组合面经摘要并实现创建/继续复盘入口 `src/modules/applications/ui/recruitment-stage-timeline.tsx`

**Checkpoint**: 用户可独立完成“具体阶段 → 创建面经 → 打开面经”的旅程。

---

## Phase 4: User Story 2 - 使用 Markdown 记录并完成复盘 (Priority: P1) MVP Part 2

**Goal**: 用户可在单一 Markdown 文档中自由记录面经并预览，获得可靠自动保存、版本冲突保护和可验证的完成状态。

**Independent Test**: 保存含标题、列表和代码的 Markdown 面经，刷新后原文与预览完整；空内容不能完成；双标签冲突不会覆盖较新内容。

### Tests for User Story 2

- [X] T023 [P] [US2] 先扩展 PATCH 聚合更新、完成条件、字段错误和 version 409 契约测试 `tests/contract/interview-review.contract.test.ts`
- [X] T024 [P] [US2] 先编写问题/行动项原子替换、排序、删除和乐观冲突集成测试 `tests/integration/interviews/interview-update.test.ts`
- [X] T025 [P] [US2] 编写 Markdown 编辑/预览、旧数据兼容和完成校验组件测试 `tests/component/interviews/interview-editor.test.tsx`
- [X] T026 [P] [US2] 先编写 800ms 防抖、flush、保存成功/失败/冲突状态组件测试 `tests/component/interviews/interview-autosave.test.tsx`

### Implementation for User Story 2

- [X] T027 [US2] 实现面经聚合锁定、version 校验、问题/行动项原子替换和完成规则 `src/modules/interviews/infrastructure/postgres-interview-repository.ts`
- [X] T028 [US2] 实现更新用例、状态转换和冲突/字段错误映射 `src/modules/interviews/application/interview-service.ts`
- [X] T029 [US2] 实现 PATCH `/api/interviews/{id}` 聚合更新契约 `src/app/api/interviews/[id]/route.ts`
- [X] T030 [P] [US2] 实现单一 Markdown 编辑框与安全预览 `src/modules/interviews/ui/interview-question-list.tsx`
- [X] T031 [P] [US2] 将旧版问题、反思和行动项兼容转换为可读 Markdown `src/modules/interviews/ui/interview-editor.tsx`
- [X] T032 [US2] 实现面试背景、Markdown 内容和完成控制的聚合编辑器 `src/modules/interviews/ui/interview-editor.tsx`
- [X] T033 [US2] 实现 800ms 防抖自动保存、离开前 flush、aria-live 状态及冲突恢复 `src/modules/interviews/ui/interview-autosave.ts`
- [X] T034 [US2] 实现 Server Component 面经详情页并挂载客户端编辑器 `src/app/interviews/[id]/page.tsx`

**Checkpoint**: P1 的完整 MVP 可用，用户能把一次具体面试记录为可复用的复盘材料。

---

## Phase 5: User Story 3 - 回顾和管理面经 (Priority: P2)

**Goal**: 用户可搜索、筛选、分页、打开和删除自己的面经，并在投递详情与面经之间双向导航。

**Independent Test**: 使用多个公司、岗位、轮次、结果和状态的面经组合筛选，刷新后条件保持；删除取消不改变数据、确认后聚合消失；投递详情链接正确。

### Tests for User Story 3

- [X] T035 [P] [US3] 先编写关键词、状态/阶段/结果/日期筛选、稳定游标和默认排序单元测试 `tests/unit/interviews/interview-list-query.test.ts`
- [X] T036 [P] [US3] 先扩展 GET 列表和 DELETE 成功/404 契约测试 `tests/contract/interview-review.contract.test.ts`
- [X] T037 [P] [US3] 先编写公司/岗位/问题搜索、组合筛选、分页和删除级联集成测试 `tests/integration/interviews/interview-list.test.ts`
- [X] T038 [P] [US3] 先编写列表空状态、筛选 URL、删除确认和导航组件测试 `tests/component/interviews/interview-list.test.tsx`

### Implementation for User Story 3

- [X] T039 [US3] 实现面经列表查询参数白名单、日期范围和稳定游标解析 `src/modules/interviews/application/list-query.ts`
- [X] T040 [US3] 实现 owner 限定的公司/岗位/问题搜索、组合筛选、分页和聚合删除 `src/modules/interviews/infrastructure/postgres-interview-repository.ts`
- [X] T041 [US3] 实现列表和删除应用服务并从公开模块导出 `src/modules/interviews/application/interview-service.ts`
- [X] T042 [US3] 完成 GET `/api/interviews` 列表分支和 DELETE `/api/interviews/{id}` `src/app/api/interviews/route.ts`
- [X] T043 [P] [US3] 实现 URL 驱动的轮次/状态/结果/日期筛选器 `src/modules/interviews/ui/interview-filters.tsx`
- [X] T044 [P] [US3] 实现最近优先列表、分页、空状态和删除确认 `src/modules/interviews/ui/interview-list.tsx`
- [X] T045 [US3] 实现 `/interviews` Server Component 列表页、顶层导航链接和投递返回路径 `src/app/interviews/page.tsx`

**Checkpoint**: 用户可在面经工作区稳定找到和管理历史复盘。

---

## Phase 6: User Story 4 - 处理阶段变化并保护隐私 (Priority: P2)

**Goal**: 阶段修正/删除和投递删除遵守保留或级联规则；所有面经边界严格隔离 owner，本轮结果不改变投递状态。

**Independent Test**: 修改并删除已关联阶段后面经仍可读且保留快照；删除投递后面经消失；用户 A 对用户 B 面经的列表/GET/PATCH/DELETE 全部拒绝且无信息泄漏。

### Tests for User Story 4

- [X] T046 [P] [US4] 先编写阶段更新保持 occurrence ID、阶段删除 SET NULL、投递级联和本轮结果独立性集成测试 `tests/integration/interviews/interview-lifecycle.test.ts`
- [X] T047 [P] [US4] 先编写双用户列表/详情/创建/更新/删除隔离集成测试 `tests/integration/interviews/interview-owner-isolation.test.ts`
- [X] T048 [P] [US4] 先编写阶段解除提示、投递级联提示和未关联快照显示组件测试 `tests/component/interviews/interview-lifecycle.test.tsx`
- [X] T049 [P] [US4] 先编写跨用户拒绝、阶段解除和投递删除关键旅程 E2E `tests/e2e/interview-review-isolation.spec.ts`

### Implementation for User Story 4

- [X] T050 [US4] 增加 stage_changed 事件、保持 occurrence ID 的阶段更新函数及 owner 校验迁移 `supabase/migrations/20260820000200_interview_stage_changed_event.sql`
- [X] T051 [US4] 扩展阶段仓储/服务以更新 occurrence 并返回面经关联摘要 `src/modules/applications/infrastructure/postgres-application-repository.ts`
- [X] T052 [US4] 实现 PATCH 阶段 occurrence 的 Route Handler 和统一错误映射 `src/app/api/applications/[id]/stages/[occurrenceId]/route.ts`
- [X] T053 [US4] 更新阶段删除、投递删除确认文案和面经解除/级联数量提示 `src/modules/applications/ui/delete-application-dialog.tsx`
- [X] T054 [US4] 在面经详情展示当前关联或快照状态，并确保本轮结果不触发投递写入 `src/modules/interviews/ui/interview-editor.tsx`

**Checkpoint**: 面经隐私、阶段生命周期和删除语义完整可验证。

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 完成跨故事的视觉、无障碍、性能、文档和发布门禁。

- [X] T055 [P] 为面经列表、编辑器、状态徽标、问题对照和窄视口布局添加共享 token 样式 `src/app/globals.css`
- [X] T056 [P] 扩展键盘、焦点、aria-live、对比度和 375/768/1280px 视口可访问性 E2E `tests/e2e/accessibility.spec.ts`
- [X] T057 [P] 增加完整阶段创建→多问题复盘→筛选回顾→删除主流程 E2E `tests/e2e/interview-review.spec.ts`
- [X] T058 [P] 增加 10,000 篇面经及问题/行动项的固定性能种子 `tests/performance/seed-interviews.ts`
- [X] T059 增加面经搜索/筛选/更新 p95 基准并接入脚本 `tests/performance/interview_performance.py`
- [X] T060 [P] 更新模块边界、隐私日志和面经运维说明 `docs/architecture.md`
- [X] T061 按 quickstart 运行格式、lint、类型、覆盖率、数据库、契约、E2E、可访问性、性能和生产构建并记录结果 `specs/002-interview-review/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: 可立即开始。
- **Phase 2 Foundational**: 依赖 Phase 1，阻塞所有用户故事。
- **Phase 3 US1**: 依赖 Foundational，建立阶段关联和创建入口。
- **Phase 4 US2**: 依赖 US1 的可读取面经聚合；与 US1 一起构成推荐 MVP。
- **Phase 5 US3**: 依赖 Foundational 和可持久化的面经；可在 US1 后与 US2 的 UI 工作并行，但最终删除/详情集成需等待 US2。
- **Phase 6 US4**: 依赖 US1 的关联模型；owner 测试可先行，阶段/投递 UI 集成应在 US2/US3 后完成。
- **Phase 7 Polish**: 依赖计划纳入发布的全部故事。

### User Story Dependency Graph

```text
Setup → Foundational → US1 ─┬→ US2 ─┐
                            ├→ US3 ─┼→ Polish
                            └→ US4 ─┘
```

### Within Each User Story

- 测试任务必须先执行并确认会在缺少实现时失败。
- 领域/查询规则先于仓储，仓储先于应用服务，应用服务先于 Route Handler 和页面。
- Server Component 负责首屏读取，Client Component 只承载交互状态。
- 每个故事完成后按 Independent Test 单独验收，再进入下一阶段。

### Parallel Opportunities

- T002–T003 可并行；T004–T005、T011 可在不修改同一文件时并行。
- US1 的 T013–T015 可并行编写。
- US2 的 T023–T026 可并行；T030 与 T031 可并行实现。
- US3 的 T035–T038 可并行；T043 与 T044 可并行实现。
- US4 的 T046–T049 可并行编写。
- Polish 的 T055–T058、T060 可在各自文件上并行。

## Parallel Execution Examples

### User Story 1

```text
T013 contract test | T014 database integration test | T015 component test
```

### User Story 2

```text
T023 contract test | T024 integration test | T025 editor test | T026 autosave test
T030 question UI | T031 action item UI
```

### User Story 3

```text
T035 query unit test | T036 contract test | T037 integration test | T038 component test
T043 filters UI | T044 list UI
```

### User Story 4

```text
T046 lifecycle integration | T047 owner isolation | T048 component test | T049 E2E
```

## Implementation Strategy

### MVP First

1. 完成 Phase 1 和 Phase 2。
2. 完成 US1，验证阶段可准确创建/打开唯一面经。
3. 完成 US2，验证问题、复盘、行动项和自动保存。
4. 停止扩展，按 P1 quickstart 验证并演示完整 MVP。

### Incremental Delivery

1. **MVP**: Setup + Foundational + US1 + US2。
2. **管理增强**: 加入 US3 的列表、搜索、筛选和删除。
3. **数据安全完整性**: 加入 US4 的阶段生命周期和隔离验证。
4. **Release**: 完成 Polish、全部质量门禁和性能预算。

## Notes

- `[P]` 仅表示文件和前置依赖允许并行，不要求使用子智能体。
- 不新增第三方运行时依赖；优先复用现有模块模式和共享 UI。
- 数据库迁移必须从空库和包含现有投递数据的数据库重放。
- 任何跨 owner 请求都不得通过错误信息泄露资源存在性。
- 每个任务或紧密相关的小组完成后均可独立提交和回滚。
