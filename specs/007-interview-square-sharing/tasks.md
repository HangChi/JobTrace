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
