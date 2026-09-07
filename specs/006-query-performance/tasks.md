# Tasks: 查询性能渐进优化

**Input**: Design documents from `/specs/006-query-performance/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/query-contract.md

**Tests**: Correctness and representative performance tests are required by FR-001, FR-002 and the project constitution.

## Phase 1: Setup

**Purpose**: Freeze scope, budgets and local-only validation.

- [x] T001 Record specification, research, data model, compatibility contract and validation guide in specs/006-query-performance/

---

## Phase 2: Foundational

**Purpose**: Measure the production repository shapes before changing them.

- [x] T002 Add full application, interview, analytics and campaign repository measurements with result-shape assertions in tests/performance/repository-performance.ts
- [x] T003 Register the full repository performance runner in tests/performance/all_performance.py and package.json

**Checkpoint**: Baseline captures complete repository behavior and fails when a 500 ms read budget is exceeded.

---

## Phase 3: User Story 1 - 快速浏览私人记录 (Priority: P1) 🎯 MVP

**Goal**: Limit child aggregation to the selected page while preserving totals, ordering and cursor behavior.

**Independent Test**: Run application and interview integration suites plus the 10,000-record full repository benchmark.

- [x] T004 [US1] Add regression coverage for exact totals, empty deep pages, stable cursors and child counts in tests/integration/applications/application-list-query.test.ts and tests/integration/interviews/interview-list.test.ts
- [x] T005 [US1] Rewrite application list selection to count the filtered set and aggregate stages only for selected rows in src/modules/applications/infrastructure/postgres-application-repository.ts
- [x] T006 [US1] Rewrite interview list selection to count the filtered set and count questions/actions only for selected rows in src/modules/interviews/infrastructure/postgres-interview-repository.ts
- [x] T007 [US1] Validate private-list correctness and performance with pnpm integration and pnpm performance

**Checkpoint**: US1 meets SC-001 and SC-002 without changing the public page contract.

---

## Phase 4: User Story 2 - 稳定查看分析报告 (Priority: P2)

**Goal**: Reuse one owner-scoped fact set and limit a complete report to at most two database tasks.

**Independent Test**: Run analytics integration tests and the 10,000-application full report benchmark, comparing every aggregate to the existing fixture expectations.

- [x] T008 [US2] Extend analytics regression coverage for empty, filtered, comparison and owner-isolated reports in tests/integration/analytics/analytics-report.test.ts
- [x] T009 [US2] Consolidate each analytics range into one database query and fold the city catalog into the current-range query in src/modules/analytics/infrastructure/postgres-analytics-report.ts
- [x] T010 [US2] Validate analytics correctness, query-task bound and performance with pnpm integration and pnpm performance

**Checkpoint**: US2 meets SC-003 and retains all analytics contracts.

---

## Phase 5: User Story 3 - 快速浏览公共岗位 (Priority: P3)

**Goal**: Serve company browse summaries from a rebuildable public read model while merging owner state at read time.

**Independent Test**: Replay migrations, run campaign/sync consistency integration tests, and run the 100-company/100,000-post full repository benchmark.

- [x] T011 [US3] Add migration and integration assertions for public-only summary rebuild, open/closed modes and atomic sync refresh in supabase/tests/007_job_market_test.sql and tests/integration/job-market/sync-consistency.test.ts
- [x] T012 [US3] Add the company summary table, refresh functions, initial rebuild and evidence-backed indexes in supabase/migrations/20260907000100_job_market_company_read_model.sql
- [x] T013 [US3] Refresh affected summaries from source status and catalog mutations in src/modules/job-market/infrastructure/postgres-sync-repository.ts and src/modules/job-market/infrastructure/postgres-source-catalog-repository.ts
- [x] T014 [US3] Read public campaign summaries from the read model and merge owner favorites at request time in src/modules/job-market/infrastructure/postgres-campaign-query.ts
- [x] T015 [US3] Validate migration replay, sync atomicity, owner isolation and 100,000-post read/write budgets with pnpm db:reset:verify, pnpm integration and pnpm performance

**Checkpoint**: US3 meets SC-004 through SC-006 and can rebuild projections from normalized tables.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T016 Update architecture and testing guidance for bounded aggregation, report query limits and read-model rebuild in docs/architecture.md and docs/testing.md
- [x] T017 Run pnpm format, pnpm lint, pnpm typecheck, pnpm test and the complete quickstart validation from specs/006-query-performance/quickstart.md

---

## Dependencies & Execution Order

- Setup precedes the baseline harness.
- T002-T003 block all query rewrites.
- US1, US2 and US3 are executed sequentially so every increment receives an isolated correctness/performance checkpoint.
- US3 migration work precedes repository adoption; normalized tables remain the rollback source.
- Documentation and the complete quality gate follow all desired stories.

## Implementation Strategy

1. Establish the full-query baseline.
2. Deliver and validate US1 as the minimum useful optimization.
3. Deliver US2 without changing reporting semantics.
4. Deliver US3 with an atomic, rebuildable projection.
5. Run the complete local gate. Do not push or deploy.

## Format Validation

All implementation items use the required checkbox, sequential task ID, user-story label where applicable, action and explicit repository path.
