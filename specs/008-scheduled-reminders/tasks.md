# Tasks: 可定时的求职待办提醒

**Input**: Design documents from `/specs/008-scheduled-reminders/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md

**Tests**: Required by the JobTrace constitution. Story tests are written before the corresponding implementation and must fail for the intended reason.

**Organization**: Tasks are grouped by user story so each story remains independently testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it uses different files and does not depend on another incomplete task in the same phase.
- **[Story]**: Maps directly to the numbered user story in spec.md.

## Phase 1: Setup

**Purpose**: Establish the module and runtime configuration without changing reminder behavior.

- [X] T001 Create the reminders module public surface and folders in `src/modules/reminders/index.ts`, `src/modules/reminders/application/contracts.ts`, and `src/modules/reminders/domain/reminder-rules.ts`
- [X] T002 [P] Add reminder scheduler variables and safe defaults to `src/shared/config/env.ts`, `.env.example`, and `.github/workflows/ci.yml`
- [X] T003 [P] Add the external one-minute reminder scheduler workflow skeleton to `.github/workflows/reminder-delivery.yml`

---

## Phase 2: Foundational

**Purpose**: Shared persistence, validation, and ownership boundaries that block every user story.

- [X] T004 Add scheduled reminder, notification attempt, and typed suggestion-resolution schema with legacy dismissal backfill in `supabase/migrations/20260927000300_scheduled_reminders.sql`
- [X] T005 Regenerate and validate schema metadata in `src/generated/database.types.ts` using `pnpm db:types`
- [X] T006 [P] Write failing time conversion, lead-time, and lifecycle tests in `tests/unit/reminders/reminder-rules.test.ts`
- [X] T007 Implement Beijing-time parsing, lead-time calculation, lifecycle guards, Zod inputs, and display helpers in `src/modules/reminders/domain/reminder-rules.ts` and `src/modules/reminders/application/contracts.ts`
- [X] T008 Implement owner-scoped reminder CRUD, optimistic locking, summary reads, suggestion resolution, and delivery claim/finalization in `src/modules/reminders/infrastructure/postgres-reminder-repository.ts`
- [X] T009 Export production service wiring from `src/modules/reminders/index.ts` and centralize reminder error mapping in `src/modules/reminders/application/reminder-service.ts`

**Checkpoint**: Schema, contracts, time rules, ownership, and repository operations are ready for all stories.

---

## Phase 3: User Story 1 - 为投递设置定时提醒 (Priority: P1) 🎯 MVP

**Goal**: A user can create and edit a reminder with a concrete event time, lead-time preset or custom notification time, and a visible final notification preview.

**Independent Test**: From one owned application, create a reminder for 14:00 with a one-hour lead, verify 13:00 is stored/displayed, edit the event to 15:00, and confirm the notification becomes 14:00 while cross-owner access is rejected.

### Tests for User Story 1

- [X] T010 [P] [US1] Write failing create/edit/validation/ownership contract tests in `tests/contract/reminders.contract.test.ts`
- [X] T011 [P] [US1] Write failing persistence, optimistic conflict, and owner-isolation tests in `tests/integration/reminders/reminder-lifecycle.test.ts`
- [X] T012 [P] [US1] Write failing accessible editor and calculated-preview component tests in `tests/component/reminders/reminder-editor.test.tsx`

### Implementation for User Story 1

- [X] T013 [US1] Implement list/create and owner-scoped edit/cancel Route Handlers in `src/app/api/reminders/route.ts` and `src/app/api/reminders/[id]/route.ts`
- [X] T014 [US1] Implement the reusable create/edit dialog with preset/custom notification times and email eligibility UI in `src/modules/reminders/ui/reminder-editor-dialog.tsx`
- [X] T015 [US1] Add “设置提醒” entry points and active reminder context to `src/modules/applications/ui/application-detail-dialog.tsx` and `src/app/(protected)/applications/[id]/page.tsx`
- [X] T016 [US1] Add responsive, token-based, WCAG-compliant reminder editor styling to `src/app/globals.css`

**Checkpoint**: User Story 1 works without scheduler or email and is deployable as an in-app scheduled reminder MVP.

---

## Phase 4: User Story 2 - 通过邮件接收提醒 (Priority: P1)

**Goal**: Email-enabled reminders are claimed safely at their notification time and sent once through the existing mail adapter, while in-app reminders survive delivery failure.

**Independent Test**: With a verified email and stub mail service, trigger two concurrent scheduler calls for one due reminder and verify one attempt identity and at most one accepted email; repeat with a failing service and verify the reminder remains due.

### Tests for User Story 2

- [ ] T017 [P] [US2] Write failing mail payload, scheduler authorization, bounded batch, idempotency, lease recovery, and failure-fallback tests in `tests/unit/reminders/reminder-delivery.test.ts` and `tests/integration/reminders/reminder-delivery.test.ts`
- [X] T018 [P] [US2] Write failing reminder email template validation and escaping tests in `deploy/mail-adapter/test_app.py`

### Implementation for User Story 2

- [X] T019 [US2] Extend the shared delivery contract for `scheduled_reminder` in `src/modules/identity-access/infrastructure/email-delivery.server.ts`
- [X] T020 [US2] Implement escaped reminder text/HTML templates and payload validation in `deploy/mail-adapter/app.py`
- [X] T021 [US2] Implement due-claim orchestration, bounded retries, verified-email lookup, and fenced result finalization in `src/modules/reminders/application/reminder-delivery-service.ts`
- [X] T022 [US2] Implement constant-time Bearer authorization and the internal delivery Route Handler in `src/app/api/internal/reminders/deliver/route.ts`
- [X] T023 [US2] Finish scheduler invocation, secret validation, and safe diagnostics in `.github/workflows/reminder-delivery.yml`, `src/shared/config/env.ts`, and `docs/operations.md`

**Checkpoint**: User Stories 1 and 2 deliver reliable in-app and email reminders without duplicate sends.

---

## Phase 5: User Story 3 - 处理到期提醒 (Priority: P1)

**Goal**: Users can complete, snooze, cancel, reopen, or retry email for reminders with optimistic concurrency.

**Independent Test**: Complete one due reminder, snooze another by 30 minutes, reopen a completed reminder with a new time, and retry a failed email; verify stale versions are rejected and old notification times never send.

### Tests for User Story 3

- [X] T024 [P] [US3] Write failing transition and stale-version integration tests in `tests/integration/reminders/reminder-actions.test.ts`
- [X] T025 [P] [US3] Write failing complete/snooze/reopen/cancel/retry component tests in `tests/component/reminders/reminder-actions.test.tsx`

### Implementation for User Story 3

- [X] T026 [US3] Implement complete, snooze, reopen, and retry-email application operations in `src/modules/reminders/application/reminder-service.ts`
- [X] T027 [US3] Implement action Route Handlers in `src/app/api/reminders/[id]/complete/route.ts`, `src/app/api/reminders/[id]/snooze/route.ts`, `src/app/api/reminders/[id]/reopen/route.ts`, and `src/app/api/reminders/[id]/retry-email/route.ts`
- [X] T028 [US3] Implement reminder row actions, confirmation, snooze picker, conflict refresh, and live feedback in `src/modules/reminders/ui/reminder-item.tsx`

**Checkpoint**: All P1 reminder lifecycle flows work independently and preserve notification correctness.

---

## Phase 6: User Story 4 - 将现有进展建议转为提醒 (Priority: P2)

**Goal**: Existing progress suggestions clearly support scheduling, completion, and dismissal without changing historical meaning.

**Independent Test**: Schedule one suggestion, complete one, dismiss one, and create a new stage after dismissal; verify the original suggestions disappear for distinct reasons and only the new stage can generate a new suggestion.

### Tests for User Story 4

- [ ] T029 [P] [US4] Write failing legacy-backfill, resolution, conversion atomicity, and new-stage tests in `tests/integration/reminders/progress-suggestion-resolution.test.ts`
- [X] T030 [P] [US4] Update failing suggestion action/component expectations in `tests/component/analytics/progress-reminder-list.test.tsx`

### Implementation for User Story 4

- [X] T031 [US4] Replace the legacy completion-only service with typed complete/dismiss/schedule resolution in `src/modules/analytics/application/progress-reminder-service.ts` and `src/app/api/analytics/progress-reminders/[stageOccurrenceId]/resolve/route.ts`
- [ ] T032 [US4] Update analytics contracts and queries to expose suggestions while excluding all resolved stage instances in `src/modules/analytics/application/contracts.ts` and `src/modules/analytics/infrastructure/postgres-analytics.ts`
- [X] T033 [US4] Replace the ambiguous “不再提醒” control with schedule, complete, and confirmed dismiss actions in `src/modules/analytics/ui/progress-reminder-list.tsx`

**Checkpoint**: Legacy suggestions and new user reminders form one coherent flow without duplicate items.

---

## Phase 7: User Story 5 - 集中查看和管理提醒 (Priority: P2)

**Goal**: The existing job overview groups due reminders, upcoming reminders, and system suggestions and allows users to inspect completed/cancelled history.

**Independent Test**: Create reminders across statuses and applications, verify default grouping/order and history filters, then open the associated application from a reminder.

### Tests for User Story 5

- [ ] T034 [P] [US5] Write failing summary grouping, ordering, filtering, and pagination tests in `tests/integration/reminders/reminder-summary.test.ts`
- [ ] T035 [P] [US5] Write failing grouped-panel, empty, loading, error, and keyboard tests in `tests/component/reminders/reminder-panel.test.tsx`

### Implementation for User Story 5

- [X] T036 [US5] Add reminder summary data to the applications dashboard read path in `src/app/(protected)/applications/page.tsx` and `src/modules/applications/ui/application-dashboard.tsx`
- [X] T037 [US5] Implement grouped active/history views and application links in `src/modules/reminders/ui/reminder-panel.tsx`
- [X] T038 [US5] Replace the existing progress-only panel composition with the reminder panel in `src/modules/analytics/ui/analytics-panel.tsx` and add responsive styling in `src/app/globals.css`

**Checkpoint**: All five user stories are independently demonstrable from the existing application dashboard.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Close lifecycle, performance, accessibility, operations, and release-quality gaps across stories.

- [ ] T039 [P] Add application terminal-status reminder choice and deletion warning/cancellation coverage in `src/modules/applications/ui/application-editor.tsx`, `src/modules/applications/ui/delete-application-dialog.tsx`, and `tests/component/applications/`
- [ ] T040 [P] Add end-to-end creation, delivery fallback, completion, snooze, suggestion conversion, owner isolation, and accessibility coverage in `tests/e2e/reminders.spec.ts`
- [ ] T041 [P] Add 10,000-reminder query and due-claim performance coverage in `tests/performance/reminder-performance.ts` and `tests/performance/all_performance.py`
- [X] T042 Update `docs/operations.md`, `.env.example`, and `specs/008-scheduled-reminders/quickstart.md` with production scheduling, metrics, alerts, secret rotation, and rollback instructions
- [ ] T043 Run formatter, typecheck, lint, unit/component tests, mail-adapter tests, contract, integration, E2E, performance checks, and `pnpm build`; fix failures and record validation results in `specs/008-scheduled-reminders/validation-report.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup** starts immediately.
- **Foundational** depends on Setup and blocks all stories.
- **US1** depends on Foundational and is the in-app MVP.
- **US2** depends on Foundational plus the US1 reminder entity/contracts.
- **US3** depends on US1 lifecycle persistence; email retry also uses US2.
- **US4** depends on US1 create flow so suggestion conversion can be atomic.
- **US5** depends on US1 summary reads and US4 suggestion semantics.
- **Polish** follows all selected stories.

### User Story Dependency Graph

```text
Setup → Foundation → US1 ─┬→ US2 → US3
                          ├→ US4 ─┐
                          └───────┴→ US5 → Polish
```

### Parallel Opportunities

- T002 and T003 can run while T001 establishes the module folders.
- T006 can be written while T004 is prepared; T005 follows the migration.
- Within each story, contract/integration/component tests marked `[P]` use separate files.
- US2 mail-adapter tests and TypeScript scheduler tests can be written in parallel.
- US4 analytics component tests and persistence tests can be written in parallel.
- T039–T041 cover separate cross-cutting surfaces and can run in parallel after the stories.

## Implementation Strategy

### MVP First

1. Complete Setup and Foundational phases.
2. Complete US1 to ship reliable in-app reminders with explicit dates/times.
3. Validate US1 independently before enabling scheduled email delivery.

### Incremental Delivery

1. US1: Create/edit in-app reminders.
2. US2: Add safe email delivery.
3. US3: Add complete/snooze/reopen/cancel/retry lifecycle.
4. US4: Upgrade legacy progress suggestions.
5. US5: Finish grouped management and history.
6. Polish: application lifecycle warnings, E2E, performance, operations, and full release gates.

## Format Validation

All executable tasks use the required checkbox, sequential `T###` ID, optional `[P]`, required user-story label within story phases, and concrete repository path.
