# Tasks: 个人面经与面经广场

**Input**: Design documents from `/specs/007-interview-square-sharing/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml

**Tests**: Required by the project constitution and feature specification. Test tasks precede their implementation tasks.

## Phase 1: Setup

- [x] T001 Verify Spec Kit artifacts, current Next.js documentation, and repository ignore configuration in `specs/007-interview-square-sharing/`, `node_modules/next/dist/docs/`, `.gitignore`, and `eslint.config.mjs`

## Phase 2: Foundational

- [x] T002 [P] Add publication state domain tests in `tests/unit/interviews/interview-publication.test.ts`
- [x] T003 [P] Add publication migration and constraint integration coverage in `tests/integration/interviews/interview-publication.test.ts`
- [x] T004 Add visibility enums, columns, constraints, update semantics, and public index in `supabase/migrations/20260913000100_interview_square_sharing.sql`
- [x] T005 Extend generated schema types and interview publication contracts in `src/generated/database.types.ts`, `src/modules/interviews/domain/catalog.ts`, `src/modules/interviews/domain/interview.schema.ts`, and `src/modules/interviews/application/contracts.ts`

## Phase 3: User Story 1 - 安全发布已完成面经 (P1)

**Goal**: Authors can safely publish completed reviews anonymously or with attribution and reverse the action.

**Independent Test**: Complete a review, publish anonymously, switch attribution, unpublish, and downgrade status; verify each persisted transition.

- [x] T006 [US1] Extend owner repository update/read mapping for publication fields in `src/modules/interviews/infrastructure/postgres-interview-repository.ts`
- [x] T007 [US1] Add sharing controls and autosave payload behavior in `src/modules/interviews/ui/interview-editor.tsx`
- [x] T008 [US1] Add component coverage for publication controls and automatic unpublish in `tests/component/interviews/interview-editor.test.tsx`

## Phase 4: User Story 2 - 浏览面经广场 (P1)

**Goal**: Authenticated users can browse and read only sanitized completed public reviews.

**Independent Test**: Query anonymous, attributed, private, and withdrawn fixtures as another user; only valid public DTOs are returned.

- [x] T009 [P] [US2] Add public query and DTO isolation tests in `tests/integration/interviews/interview-publication.test.ts` and `tests/contract/interview-public-square.contract.test.ts`
- [x] T010 [US2] Implement public query parser, repository ports, services, and minimal DTO mapping in `src/modules/interviews/application/public-list-query.ts`, `src/modules/interviews/application/ports.ts`, `src/modules/interviews/application/interview-service.ts`, and `src/modules/interviews/infrastructure/postgres-interview-repository.ts`
- [x] T011 [P] [US2] Add authenticated public list/detail handlers in `src/app/api/interviews/public/route.ts` and `src/app/api/interviews/public/[id]/route.ts`
- [x] T012 [US2] Build public filters, cards, and sanitized detail UI in `src/modules/interviews/ui/public-interview-filters.tsx`, `src/modules/interviews/ui/public-interview-list.tsx`, and `src/modules/interviews/ui/public-interview-detail.tsx`
- [x] T013 [US2] Convert `/interviews` to the square and add `/interviews/shared/[id]` in `src/app/(protected)/interviews/page.tsx` and `src/app/(protected)/interviews/shared/[id]/page.tsx`

## Phase 5: User Story 3 - 从账号菜单管理个人面经 (P2)

**Goal**: Personal management moves to the account menu while the primary navigation points to the square.

**Independent Test**: Navigate from the account menu to the complete owner list and from primary navigation to the public-only square.

- [x] T014 [P] [US3] Add publication filter parsing and owner list badges in `src/modules/interviews/application/list-query.ts`, `src/modules/interviews/ui/interview-filters.tsx`, and `src/modules/interviews/ui/interview-list.tsx`
- [x] T015 [US3] Add `/interviews/mine` owner page and update owner return links in `src/app/(protected)/interviews/mine/page.tsx` and `src/modules/interviews/ui/interview-editor.tsx`
- [x] T016 [US3] Rename primary navigation and add account-menu entry in `src/modules/identity-access/ui/primary-nav.tsx` and `src/modules/identity-access/ui/account-menu.tsx`
- [x] T017 [US3] Update navigation, list, and responsive component coverage in `tests/component/interviews/interview-list.test.tsx` and `tests/e2e/interview-review.spec.ts`

## Phase 6: Polish and validation

- [x] T018 Update database type snapshots and run focused unit/component/integration/contract tests via `pnpm db:types:clean`, Vitest, and Playwright suites
- [x] T019 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, and applicable performance checks documented in `specs/007-interview-square-sharing/quickstart.md`
- [x] T020 Mark completed tasks and record final validation status in `specs/007-interview-square-sharing/tasks.md`

## Dependencies

- T001 precedes all work.
- T002–T005 establish publication state and block all user stories.
- US1 (T006–T008) and US2 test preparation (T009) can proceed after foundations; T010–T013 require the shared model.
- US3 depends on the public square page and owner publication fields.
- Validation tasks depend on all desired stories.

## Implementation strategy

Deliver US1 publication safety first, then US2 public reading boundary, then US3 navigation separation. Keep owner queries and public DTO queries separate throughout, and validate data-leak assertions before UI completion.

## Validation record

- `pnpm db:types:clean`: passed.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed with six pre-existing warnings outside this feature.
- `pnpm test`: 332/333 passed; the remaining pre-existing job-market catalog test expects an outdated company/source count in `docs/architecture.md`.
- Interview unit and component suites: 30 passed.
- Integration suite: 45 passed.
- Public API contract coverage: passed; the full contract suite has one pre-existing duplicate-identity expectation failure outside this feature.
- Interview E2E journeys: 2 passed, including owner isolation and anonymous publication; the full E2E suite had one unrelated recruitment-marketplace filter failure.
- `pnpm build`: passed.
- 10,000-row interview benchmark: public list p95 29.01 ms, public detail p95 25.20 ms, publication p95 28.79 ms.

## Phase 7: 面经动态流增量

- [x] T021 Update the square specification and public feed contract for direct in-feed reading.
- [x] T022 Extend the sanitized public list projection with question and reflection content without exposing owner-only fields.
- [x] T023 Replace the summary-row list with a responsive, single-column social feed and retain the independent detail route.
- [x] T024 Add contract, component, responsive, accessibility, and performance regression coverage for the feed.
- [x] T025 Run final validation and record the dynamic-feed benchmark.

### Dynamic-feed validation

- Public feed contract: passed; list responses include sanitized review bodies without owner-only fields.
- Feed component suite: passed; cards render questions, answers, reflections, attribution, and detail navigation directly in the stream.
- Browser regression: passed in Chromium with zero axe violations, no private action-item disclosure, and no horizontal overflow at 375px.
- 10,000-row benchmark: public feed list p95 27.59 ms, public detail p95 25.81 ms, publication p95 28.93 ms.

## Phase 8: 广场视觉收敛

- [x] T026 Remove the oversized square hero and replace it with a compact feed toolbar.
- [x] T027 Reduce public discovery controls to company-name search only in the UI, query contract, and repository.
- [x] T028 Verify the simplified search, responsive feed layout, accessibility, and production build.

### Simplified-square validation

- Company-search unit and component coverage: 5 tests passed.
- Public API contract: passed, including rejection of question-body search matches.
- Chromium journey: passed with no oversized square heading, one searchbox, zero axe violations, and no horizontal overflow at 375px.
- `pnpm typecheck` and `pnpm build`: passed; lint completed with six pre-existing warnings outside this feature.

## Phase 9: 参考社区卡片视觉

- [x] T029 Restructure feed cards around author metadata, company identity, and a contained interview preview.
- [x] T030 Add progressive disclosure for multi-question reviews without introducing unsupported social metrics or comments.
- [x] T031 Verify card semantics, visual fidelity, responsive behavior, and regression coverage.

### Community-card validation

- Focused public-list query, filter, and feed component suites: 5 tests passed.
- Chromium journey: passed with zero axe violations, company-only search, detail navigation, and no horizontal overflow at 375px.
- Visual inspection: confirmed the author-first card hierarchy, contained first-question preview, and multi-question disclosure against the supplied reference.
- `pnpm typecheck` and `pnpm build`: passed; lint completed with six pre-existing warnings outside this feature.

## Phase 10: 搜索排序与社区互动增量

**Goal**: Users can combine company, city, and position discovery, switch between latest and hot ordering, and use persistent likes, comments, and unique views.

**Independent Test**: With multiple users and public/private reviews, verify combined filters, stable cursors, hot ranking, like toggling, attributed comment validation, unique detail views, cascades, and uniform 404 behavior after unpublishing.

- [x] T032 [P] [US2] Add query parsing, filtering, facet, sorting, and cursor tests in `tests/unit/interviews/public-list-query.test.ts` and `tests/contract/interview-public-square.contract.test.ts`
- [x] T033 [P] [US4] Add interaction contract and integration coverage in `tests/contract/interview-public-square.contract.test.ts` and `tests/integration/interviews/interview-engagement.test.ts`
- [x] T034 [US4] Add engagement tables, counter triggers, public-state guards, and hot index in `supabase/migrations/20260913000200_interview_square_engagement.sql`
- [x] T035 [US2] Extend public DTOs, query parsing, repository filtering, facets, hot ordering, and viewer state in `src/modules/interviews/application/` and `src/modules/interviews/infrastructure/postgres-interview-repository.ts`
- [x] T036 [US4] Implement authenticated like, comment, and unique-view services and route handlers in `src/modules/interviews/` and `src/app/api/interviews/public/[id]/`
- [x] T037 [P] [US2] Build the compact company/city/position toolbar and accessible latest/hot segmented control in `src/modules/interviews/ui/public-interview-filters.tsx` and `src/app/(protected)/interviews/page.tsx`
- [x] T038 [US4] Add interactive engagement counts, optimistic like state, attributed comment form/list, loading, and error feedback in `src/modules/interviews/ui/public-interview-engagement.tsx`, feed cards, and public detail
- [x] T039 [P] [US4] Add component and E2E coverage for keyboard interaction, feedback, 375px reflow, and WCAG 2.2 AA in `tests/component/interviews/` and `tests/e2e/interview-review-isolation.spec.ts`
- [x] T040 Regenerate database schema snapshot, run focused and full validation, measure representative hot-feed performance, and record results in `specs/007-interview-square-sharing/tasks.md`

### Increment dependencies

- T032 and T033 define failing behavior before implementation.
- T034 blocks repository and interaction writes in T035–T036.
- T035 enables T037; T036 enables T038.
- T039 follows the UI behavior; T040 is the final release gate.

### Discovery and engagement validation

- Query/filter/engagement component suites: 10 tests passed, including clipboard share fallback.
- Public contract and engagement integration suites: passed, including field isolation, like toggling, comment attribution, unique views, counters, cascades, and post-unpublish 404 behavior.
- Chromium journey: passed with combined company/city/position filtering, hot sorting, live like/comment UI, zero axe violations, and no horizontal overflow at 375px.
- Clean migration replay and generated database schema snapshot: passed; migration was also applied to the configured development database.
- 10,000-row benchmark: public list p95 33.98ms, hot list p95 28.23ms, interaction p95 29.74ms, public detail p95 24.79ms.
- `pnpm typecheck`, production build, and lint passed; lint retains six pre-existing warnings. Full Vitest completed 338/339 tests with the known unrelated job-market architecture count mismatch remaining.
