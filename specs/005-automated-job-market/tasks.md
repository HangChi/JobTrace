---

description: "Actionable task list for the automated job market feature"
---

# Tasks: 自动招聘岗位市场

**Input**: Design documents from `specs/005-automated-job-market/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Tests are required by the JobTrace constitution. Within each user story, write the listed tests first and confirm that they fail for the intended missing behavior before implementation.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated as an incremental release.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with adjacent tasks because it targets different files and does not depend on their unfinished output.
- **[Story]**: Maps the task to a user story in `spec.md`.
- Every task includes an exact repository path.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the feature skeleton, bounded dependency, environment contract, and deterministic fixture layout.

- [X] T001 Add Cheerio 1.x as the Schema.org-only HTML parser and update the lockfile in `package.json` and `pnpm-lock.yaml`
- [X] T002 Create the job-market module boundary and public exports in `src/modules/job-market/index.ts`
- [X] T003 [P] Document `JOB_MARKET_ENABLED`, `JOB_MARKET_SYNC_SECRET`, batch size, timeout, response-size, and worker-id variables in `.env.example`
- [X] T004 [P] Add typed job-market runtime environment parsing with safe defaults and secret validation in `src/shared/config/env.ts`
- [X] T005 [P] Create the deterministic external-source fixture catalog and no-real-network rule in `tests/fixtures/job-market/README.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish public/private storage isolation, source contracts, secure fetching, and common repositories used by every story.

**⚠️ CRITICAL**: No user story implementation begins until this phase passes its database and security tests.

- [X] T006 Create additive PostgreSQL tables, enums, constraints, lifecycle fields, indexes, and leases for companies, sources, campaigns, posts, locations, source records, runs, and events in `supabase/migrations/20260830000100_job_market_core.sql`
- [X] T007 Create owner-scoped favorites and application-to-public-job association tables, unique constraints, foreign keys, and RLS policies in `supabase/migrations/20260830000200_job_market_private_links.sql`
- [X] T008 Add pgTAP coverage for job-market schema constraints, public/private separation, owner RLS, source claims, and lifecycle invariants in `supabase/tests/007_job_market_test.sql`
- [X] T009 Regenerate and commit PostgreSQL TypeScript declarations for the new tables in `src/generated/database.types.ts`
- [X] T010 [P] Define company, source, campaign, post, location, source-record, sync-run, and event domain types and state enums in `src/modules/job-market/domain/entities.ts`
- [X] T011 [P] Define normalization input/output, source adapter, secure fetch, clock, repository, and unit-of-work ports in `src/modules/job-market/application/ports.ts`
- [X] T012 [P] Define Zod schemas and response contracts matching the OpenAPI campaign, source, run, and internal-sync shapes in `src/modules/job-market/application/contracts.ts`
- [X] T013 [P] Write failing unit tests for HTTPS allowlists, public DNS/IP validation, redirect revalidation, unsafe apply URLs, timeouts, and response limits in `tests/unit/job-market/source-request-security.test.ts`
- [X] T014 Implement the abortable secure source HTTP client with exact host allowlists, public A/AAAA checks, manual redirects, content-type/size limits, and no cookie forwarding in `src/modules/job-market/infrastructure/secure-source-client.server.ts`
- [X] T015 [P] Implement typed source error codes and secret/PII-safe diagnostic summaries in `src/modules/job-market/application/source-errors.ts`
- [X] T016 [P] Implement the PostgreSQL company/campaign/post/location/source-record repository and transaction boundary in `src/modules/job-market/infrastructure/postgres-job-market-repository.ts`
- [X] T017 [P] Implement the PostgreSQL source lease, health, run, and append-only event repository in `src/modules/job-market/infrastructure/postgres-sync-repository.ts`
- [X] T018 Implement the source adapter registry with an explicit adapter allowlist in `src/modules/job-market/infrastructure/source-adapter-registry.ts`
- [X] T019 Export validated contracts, services, and repository factories without leaking infrastructure internals in `src/modules/job-market/index.ts`

**Checkpoint**: Migrations apply and reset cleanly; secure-source tests pass; shared job-market interfaces are available to all stories.

---

## Phase 3: User Story 1 - 浏览自动更新的招聘岗位 (Priority: P1) 🎯 MVP

**Goal**: Automatically synchronize approved sources and show one homepage record per company recruitment campaign with merged positions, merged locations, source, freshness, status, and filters.

**Independent Test**: Register fixture-backed approved sources, run scheduled synchronization without importing a file, and verify `/` shows one row per company/campaign; any child position/location matches filters, updates remain idempotent, and empty/stale/error states are understandable.

### Tests for User Story 1

- [X] T020 [P] [US1] Write failing unit tests for title/location normalization, campaign fallback keys, exact source identity, canonical URL matching, conservative fingerprints, official-source preference, and ambiguous non-merges in `tests/unit/job-market/normalization-and-deduplication.test.ts`
- [X] T021 [P] [US1] Write failing unit tests for open/stale/closed/reopened post transitions and derived campaign status, including failed and partial runs that must not close jobs, in `tests/unit/job-market/job-lifecycle.test.ts`
- [X] T022 [P] [US1] Add Greenhouse, Lever, Ashby, SmartRecruiters, and Schema.org adapter contract suites using only local fixtures in `tests/contract/job-market/source-adapters.contract.test.ts`
- [X] T023 [P] [US1] Add fixture payloads for normal pagination, multiple locations, optional fields, close/reopen, 429, malformed items, oversized responses, unsafe URLs, and partial batches under `tests/fixtures/job-market/sources/`
- [X] T024 [P] [US1] Write failing PostgreSQL integration tests for idempotent upserts, cross-source provenance, primary-source switching, partial success, event audit, lease competition, and two-confirmation lifecycle changes in `tests/integration/job-market/job-sync.test.ts`
- [X] T025 [P] [US1] Write failing repository integration tests for campaign pagination and combined keyword/company/location/type/status/date filters across every child post in `tests/integration/job-market/campaign-query.test.ts`
- [X] T026 [P] [US1] Write failing authenticated contract tests for `GET /api/job-market/campaigns` and `GET /api/job-market/campaigns/{id}` including validation, pagination, aggregated fields, and private-data exclusion in `tests/contract/job-market/campaigns.contract.test.ts`
- [X] T027 [P] [US1] Write failing component tests for compact aggregation, expand/collapse, filters, loading, empty, stale, partial-data, error, and responsive keyboard behavior in `tests/component/job-market/job-market-page.test.tsx`

### Implementation for User Story 1

- [X] T028 [P] [US1] Implement deterministic text, location, date, description, campaign-key, and content-hash normalization in `src/modules/job-market/domain/normalization.ts`
- [X] T029 [P] [US1] Implement the three-stage deduplication and official-primary selection rules with auditable match reasons in `src/modules/job-market/domain/deduplication.ts`
- [X] T030 [P] [US1] Implement post and campaign lifecycle transitions and explanation events in `src/modules/job-market/domain/lifecycle.ts`
- [X] T031 [P] [US1] Implement the Greenhouse public Job Board adapter with pagination and conditional-fetch metadata in `src/modules/job-market/infrastructure/adapters/greenhouse-adapter.ts`
- [X] T032 [P] [US1] Implement the Lever public Postings adapter with pagination and complete/partial batch reporting in `src/modules/job-market/infrastructure/adapters/lever-adapter.ts`
- [X] T033 [P] [US1] Implement the Ashby public Job Posting adapter with normalized locations and apply URLs in `src/modules/job-market/infrastructure/adapters/ashby-adapter.ts`
- [X] T034 [P] [US1] Implement the SmartRecruiters public adapter with pagination, status, and rate-limit handling in `src/modules/job-market/infrastructure/adapters/smartrecruiters-adapter.ts`
- [X] T035 [P] [US1] Implement the approved-host Schema.org `JobPosting` adapter using non-executing Cheerio parsing and plain-text sanitization in `src/modules/job-market/infrastructure/adapters/schema-org-adapter.ts`
- [X] T036 [US1] Implement the per-source synchronization use case with bounded item isolation, idempotent persistence, lifecycle progression, event counts, backoff, and safe logs in `src/modules/job-market/application/synchronize-source.ts`
- [X] T037 [US1] Implement due-source claiming and bounded-concurrency scheduled orchestration in `src/modules/job-market/application/synchronize-due-sources.ts`
- [X] T038 [US1] Implement constant-time internal Bearer authentication and the bounded scheduler endpoint in `src/app/api/internal/job-market/sync/route.ts`
- [X] T039 [US1] Implement campaign list/detail SQL projections with deduplicated positions/locations, stable pagination, source freshness, and current-user-only projections in `src/modules/job-market/infrastructure/postgres-campaign-query.ts`
- [X] T040 [US1] Implement campaign query parsing and list/detail application services in `src/modules/job-market/application/campaign-service.ts`
- [X] T041 [P] [US1] Implement authenticated campaign list Route Handler and problem responses in `src/app/api/job-market/campaigns/route.ts`
- [X] T042 [P] [US1] Implement authenticated campaign detail Route Handler using promised Next.js dynamic params in `src/app/api/job-market/campaigns/[campaignId]/route.ts`
- [X] T043 [P] [US1] Build the URL-driven combined filters, active-filter summary, clear action, and accessible mobile controls in `src/modules/job-market/ui/job-market-filters.tsx`
- [X] T044 [P] [US1] Build the responsive campaign row/card with compact position/location summaries, semantic status/source/freshness, and keyboard-safe expansion in `src/modules/job-market/ui/campaign-card.tsx`
- [X] T045 [US1] Compose pagination and loading/empty/stale/partial/error states into the marketplace view in `src/modules/job-market/ui/job-market-page.tsx`
- [X] T046 [US1] Replace the protected root with the authenticated recruitment marketplace and preserve URL filters in `src/app/(protected)/page.tsx`
- [X] T047 [US1] Move the existing private application dashboard to `/applications` without changing its behavior in `src/app/(protected)/applications/page.tsx`
- [X] T048 [US1] Update primary navigation to expose “招聘广场” at `/` and “我的投递” at `/applications` in `src/modules/identity-access/ui/primary-nav.tsx`
- [X] T049 [US1] Scope application pagination reset behavior to the private application workspace instead of every protected page in `src/app/(protected)/layout.tsx`
- [X] T050 [US1] Add an end-to-end MVP journey covering fixture sync, homepage aggregation, combined filtering, separate batches, updates, empty results, and no manual import in `tests/e2e/job-market-browse.spec.ts`

**Checkpoint**: User Story 1 is deployable as the MVP; scheduled fixture data reaches the homepage and is independently browsable and filterable.

---

## Phase 4: User Story 2 - 从公共岗位开始个人投递跟踪 (Priority: P2)

**Goal**: Open valid official application links directly and create an owner-private application from a selected underlying public job without duplicate tracking.

**Independent Test**: From one aggregated campaign, verify a single URL opens directly, multiple URLs require an in-row job choice, unsafe/closed URLs cannot open, and a confirmed job creates one private application visible only to its owner.

### Tests for User Story 2

- [X] T051 [P] [US2] Write failing unit tests for single/select/unavailable apply modes and closed/unsafe link rejection in `tests/unit/job-market/apply-target.test.ts`
- [X] T052 [P] [US2] Extend application contract tests for optional `jobMarketPostId`, server-derived prefill validation, and 409 responses with `existingApplicationId` in `tests/contract/applications.contract.test.ts`
- [X] T053 [P] [US2] Write failing integration tests for atomic private application/link creation, `(owner_id, post_id)` duplicate prevention, immutable snapshots, and cross-user isolation in `tests/integration/job-market/application-link.test.ts`
- [X] T054 [P] [US2] Write failing component tests for direct apply, in-row job selection, disabled-link explanations, prefilled confirmation, and duplicate navigation in `tests/component/job-market/campaign-actions.test.tsx`

### Implementation for User Story 2

- [X] T055 [P] [US2] Implement safe apply-mode derivation and per-job target selection in `src/modules/job-market/domain/apply-target.ts`
- [X] T056 [US2] Extend application create schemas/contracts with optional `jobMarketPostId` while retaining user confirmation fields in `src/modules/applications/domain/application.schema.ts`
- [X] T057 [US2] Add job-market post lookup and atomic application-link persistence ports in `src/modules/applications/application/ports.ts`
- [X] T058 [US2] Implement owner-scoped duplicate lookup, public-field prefill, immutable source snapshot, and transactional link creation in `src/modules/applications/application/application-service.ts`
- [X] T059 [US2] Implement PostgreSQL application job-market link persistence and owner enforcement in `src/modules/applications/infrastructure/postgres-application-repository.ts`
- [X] T060 [US2] Map duplicate tracking to the documented 409 problem response in `src/app/api/applications/route.ts`
- [X] T061 [P] [US2] Build the accessible in-row job/apply selector and safe external-link behavior in `src/modules/job-market/ui/apply-action.tsx`
- [X] T062 [P] [US2] Build the prefilled private application confirmation flow and existing-application redirect in `src/modules/job-market/ui/track-application-dialog.tsx`
- [X] T063 [US2] Integrate apply and tracking actions into the aggregated campaign card without adding rows in `src/modules/job-market/ui/campaign-card.tsx`
- [X] T064 [US2] Add an end-to-end journey for direct links, multi-job selection, invalid links, duplicate tracking, immutable snapshots, and two-user privacy in `tests/e2e/job-market-apply-and-track.spec.ts`

**Checkpoint**: Users can move safely from discovery to official application and private tracking; public reads disclose no private progress.

---

## Phase 5: User Story 3 - 收藏和回访岗位 (Priority: P3)

**Goal**: Persist owner-private campaign favorites, filter by them, and preserve closed campaign history without enabling invalid application actions.

**Independent Test**: Favorite a campaign, sign in again, filter to favorites, confirm another user has independent state, then close all child jobs and verify the favorite remains visible but non-actionable.

### Tests for User Story 3

- [X] T065 [P] [US3] Write failing favorite PUT/DELETE and `favorite=true` list contract tests with owner isolation in `tests/contract/job-market/favorites.contract.test.ts`
- [X] T066 [P] [US3] Write failing PostgreSQL integration tests for favorite idempotency, persistence, cross-user isolation, and closed-campaign visibility in `tests/integration/job-market/favorites.test.ts`
- [X] T067 [P] [US3] Write failing optimistic UI, rollback, keyboard label, and “仅看收藏” component tests in `tests/component/job-market/favorite-action.test.tsx`

### Implementation for User Story 3

- [X] T068 [US3] Implement owner-scoped favorite create/delete/query methods in `src/modules/job-market/infrastructure/postgres-campaign-query.ts`
- [X] T069 [US3] Implement authenticated favorite service methods with idempotent semantics in `src/modules/job-market/application/campaign-service.ts`
- [X] T070 [US3] Implement PUT and DELETE favorite Route Handlers using session-derived owner identity in `src/app/api/job-market/campaigns/[campaignId]/favorite/route.ts`
- [X] T071 [P] [US3] Build the accessible optimistic favorite control with failure rollback in `src/modules/job-market/ui/favorite-button.tsx`
- [X] T072 [US3] Integrate favorite state, favorite-only filtering, and closed-history labels into the marketplace in `src/modules/job-market/ui/job-market-page.tsx`
- [X] T073 [US3] Add an end-to-end favorite persistence, owner isolation, filtering, and closed-history journey in `tests/e2e/job-market-favorites.spec.ts`

**Checkpoint**: Favorites persist per user and remain historically useful without modifying or misrepresenting public job state.

---

## Phase 6: User Story 4 - 监控自动同步健康状态 (Priority: P4)

**Goal**: Let administrators register and control approved sources, inspect safe run diagnostics and counts, and retry one failed source without blocking marketplace reads.

**Independent Test**: Simulate success, timeout, and malformed-data sources; an admin can distinguish results, inspect safe summaries, retry only the failed source, and pause/revoke collection while a normal user continues browsing cached jobs.

### Tests for User Story 4

- [X] T074 [P] [US4] Write failing admin source list/create/patch, run-list, and single-retry contract tests for authentication, RBAC, validation, conflicts, and safe errors in `tests/contract/job-market/admin-sync.contract.test.ts`
- [X] T075 [P] [US4] Write failing integration tests for registration uniqueness, approved host persistence, pause/revoke scheduling, retry run independence, backoff, and safe diagnostic retention in `tests/integration/job-market/source-administration.test.ts`
- [X] T076 [P] [US4] Write failing component tests for source health states, change counts, safe error detail, forms, retry feedback, and keyboard access in `tests/component/job-market/admin-job-market.test.tsx`
- [X] T077 [P] [US4] Write failing observability tests proving logs contain run/source/request ids but exclude secrets, raw payloads, URLs with credentials, and contact data in `tests/integration/observability/job-market-logging.test.ts`

### Implementation for User Story 4

- [X] T078 [US4] Implement admin source registration, validation, status transition, listing, run history, and retry use cases in `src/modules/job-market/application/source-admin-service.ts`
- [X] T079 [US4] Implement source create/update/health and paginated run queries in `src/modules/job-market/infrastructure/postgres-sync-repository.ts`
- [X] T080 [P] [US4] Implement admin source GET/POST Route Handler with existing `requireAdmin` authorization in `src/app/api/admin/job-market/sources/route.ts`
- [X] T081 [P] [US4] Implement admin source PATCH Route Handler with promised dynamic params in `src/app/api/admin/job-market/sources/[sourceId]/route.ts`
- [X] T082 [P] [US4] Implement admin single-source retry Route Handler with lease/conflict handling in `src/app/api/admin/job-market/sources/[sourceId]/sync/route.ts`
- [X] T083 [P] [US4] Implement admin sync-run list Route Handler in `src/app/api/admin/job-market/sync-runs/route.ts`
- [X] T084 [P] [US4] Build the accessible source health, latest counts, freshness, and safe error table in `src/modules/job-market/ui/admin/source-health-table.tsx`
- [X] T085 [P] [US4] Build approved-source registration and pause/revoke controls with validation feedback in `src/modules/job-market/ui/admin/source-form.tsx`
- [X] T086 [US4] Build the administrator job-market page with retry progress and non-blocking refresh in `src/app/(protected)/admin/job-market/page.tsx`
- [X] T087 [US4] Add the job-market destination to existing admin navigation in `src/modules/identity-access/ui/admin-nav.tsx`
- [X] T088 [US4] Add end-to-end administrator health, safe diagnostics, retry, pause/revoke, RBAC, and concurrent user browsing coverage in `tests/e2e/job-market-admin.spec.ts`

**Checkpoint**: Operators can safely maintain source coverage and diagnose failures without manual job imports or disruption to users.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Enforce security, accessibility, performance, operations, release, and repository-wide quality gates across all delivered stories.

- [X] T089 [P] Add SSRF regression fixtures for loopback, RFC1918, IPv6 local, metadata, DNS-to-private, redirect-to-private, userinfo, redirect loops, oversized bodies, and unsafe apply URLs under `tests/fixtures/job-market/security/`
- [X] T090 Add end-to-end SSRF, dangerous markup, URL sanitization, and secret-log redaction coverage in `tests/e2e/job-market-security.spec.ts`
- [X] T091 [P] Add axe and keyboard-only marketplace/admin flows at desktop and mobile viewports in `tests/e2e/job-market-accessibility.spec.ts`
- [X] T092 [P] Add a deterministic 100-company/100,000-post performance seed in `tests/performance/job-market-seed.ts`
- [X] T093 Add campaign read, favorite/write, concurrent-sync, and filter latency checks for 500ms/1s p95 budgets in `tests/performance/job-market-performance.ts`
- [X] T094 Extend Core Web Vitals coverage for the recruitment marketplace to enforce LCP ≤2.5s, INP ≤200ms, and CLS ≤0.1 in `tests/performance/web-vitals.spec.ts`
- [X] T095 [P] Document module boundaries, adapter extension rules, deduplication, lifecycle, and privacy ownership in `docs/architecture.md`
- [X] T096 [P] Document scheduler configuration, secret rotation, rate limits, alerts, source onboarding, pause/revoke, run retention, and rollback in `docs/operations.md`
- [X] T097 [P] Document fixture-only adapter testing, coverage floors, accessibility checks, and performance data preparation in `docs/testing.md`
- [X] T098 Update CI to install any required test support and run job-market security/accessibility/performance gates without contacting real sources in `.github/workflows/ci.yml`
- [X] T099 Run migration/reset/type checks and resolve failures using `package.json` scripts `db`, `db:test`, `db:sql:test`, `db:reset:verify`, and `db:types:check`
- [X] T100 Run formatting, linting, type checking, unit/coverage, contract, integration, build, E2E, performance, and Lighthouse gates using scripts in `package.json`
- [X] T101 Execute every scenario in `specs/005-automated-job-market/quickstart.md` and record any environment-specific deviations in `docs/operations.md`
- [X] T102 Perform a final constitution review covering maintainability, ≥80% changed-code line/branch coverage, WCAG 2.2 AA, performance budgets, safe logging, and rollback evidence in `specs/005-automated-job-market/checklists/release.md`

---

## Phase 8: Default Source Bootstrap

- [X] T103 Add a reviewed, bounded public ATS catalog in `src/modules/job-market/application/default-source-catalog.ts`
- [X] T104 Add idempotent company/source initialization with operator-state preservation in `src/modules/job-market/infrastructure/postgres-source-catalog-repository.ts`
- [X] T105 Add admin-only catalog initialization and bounded first-sync orchestration in `src/modules/job-market/application/source-admin-service.ts`
- [X] T106 Add the bootstrap API and responsive administrator controls in `src/app/api/admin/job-market/bootstrap/route.ts` and `src/modules/job-market/ui/admin/default-source-bootstrap.tsx`
- [X] T107 Add catalog validation, idempotency, RBAC, component, and admin E2E coverage under `tests/`
- [X] T108 Document catalog review, initialization, scheduling, and fixture-only test boundaries in `docs/`
- [X] T109 Update the OpenAPI contract and run format, lint, typecheck, build, contract, integration, and focused E2E gates

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 — Setup**: No dependencies; starts immediately.
- **Phase 2 — Foundational**: Depends on Phase 1 and blocks all user stories.
- **Phase 3 — US1/P1 MVP**: Depends on Phase 2; establishes synchronized public data and the marketplace surface.
- **Phase 4 — US2/P2**: Depends on Phase 2 and consumes US1 campaign/post projections for the integrated UI; its application-link service can be tested independently with seeded public posts.
- **Phase 5 — US3/P3**: Depends on Phase 2 and consumes US1 campaign listing for the integrated UI; favorite persistence can be tested independently with seeded campaigns.
- **Phase 6 — US4/P4**: Depends on Phase 2 and reuses the US1 synchronization use case for retry; source administration and health queries are independently testable with fixture runs.
- **Phase 7 — Polish**: Begins after every story selected for release is complete; T099 precedes T100, and T100 precedes T101–T102.

### User Story Dependency Graph

```text
Setup → Foundation → US1 (MVP)
                   ├──→ US2
                   ├──→ US3
                   └──→ US4
US1 + US2 + US3 + US4 → Cross-cutting release gates
```

US2, US3, and US4 may start after Foundation using seeded contracts, but their final UI integration/retry tasks require the indicated US1 service or component. Deliver sequentially in priority order when one implementer owns the branch.

### Within Each User Story

1. Add tests and confirm failure for the missing behavior.
2. Implement domain rules and adapter/model behavior.
3. Implement repositories and application services.
4. Implement Route Handlers.
5. Implement components/pages.
6. Run the story's independent E2E checkpoint before starting the next priority.

## Parallel Opportunities

### Setup and Foundation

- T003–T005 target separate configuration/fixture files.
- T010–T013 define separate domain/contracts/tests after migrations are designed.
- T015–T017 target errors and separate repositories; T018 follows the adapter port from T011.

### User Story 1

```text
T020 normalization/dedup unit tests
T021 lifecycle unit tests
T022 adapter contract suite + T023 fixtures
T024 sync integration tests
T025 campaign query integration tests
T026 API contract tests
T027 component tests

After common ports/security exist:
T028 normalization, T029 deduplication, T030 lifecycle
T031 Greenhouse, T032 Lever, T033 Ashby, T034 SmartRecruiters, T035 Schema.org
T041 list route, T042 detail route, T043 filters, T044 campaign card
```

### User Story 2

```text
T051 apply-target unit tests
T052 application API contract tests
T053 private-link integration tests
T054 campaign action component tests

After service contracts settle:
T061 apply selector and T062 tracking dialog
```

### User Story 3

```text
T065 favorite contract tests
T066 favorite integration tests
T067 favorite component tests
```

### User Story 4

```text
T074 admin API contract tests
T075 source administration integration tests
T076 admin component tests
T077 safe logging tests

After T078/T079 define behavior:
T080 source collection route, T081 source item route, T082 retry route, T083 run route
T084 health table and T085 source form
```

## Implementation Strategy

### MVP First

1. Complete Setup and Foundation.
2. Complete US1 through T050.
3. Run the US1 unit, contract, integration, component, E2E, security, accessibility, and representative performance checks.
4. Deploy with `JOB_MARKET_ENABLED=false`, migrate additively, enable only local/staging fixture sources, then canary a small set of approved sources.
5. Stop and validate the MVP before adding private tracking, favorites, or the full admin console.

### Incremental Delivery

1. **MVP**: Automated sync + aggregated homepage browsing (US1).
2. **Conversion**: Safe official links + private application tracking (US2).
3. **Retention**: Owner-private favorites and closed history (US3).
4. **Operations**: Source health, registration, controls, and retry (US4).
5. **Release hardening**: Security, accessibility, 100k-data performance, documentation, and rollback drill.

Each increment must retain public/private isolation and pass all previously completed story tests. Do not enable an external source until its access basis, exact host allowlist, fixture contract, and rate-limit behavior have been reviewed.

### Phase 8: Domestic recruitment directory expansion

- [X] T090 Add a separate domestic-company recruitment directory with at least 100 total covered companies and explicit WeChat fallback metadata
- [X] T091 Extend idempotent bootstrap to create company-level directory campaigns without scheduling them as sources
- [X] T092 Render directory cards with a public-account link and without fabricated job, location, or sync facts
- [X] T093 Add migration, unit, component, contract, and database coverage for directory listings

## Phase 9: Convergence

- [X] T110 Add an additive source-candidate and directory-health persistence model with review states and safe diagnostics per SC-001 and Assumption: source discovery (missing)
- [X] T111 Add deterministic recruitment-platform detection that only recognizes reviewed official ATS URLs and Schema.org candidates without executing scripts per FR-004 and plan: Source strategy (missing)
- [X] T112 Add an administrator-triggered bounded directory scan that validates public HTTPS targets, records link health, and creates candidates without enabling synchronization per FR-004 and FR-020 (missing)
- [X] T113 Add admin-only candidate listing, approval, ignore, and rescan Route Handlers that preserve exact host allowlists and access-basis review per plan: Source strategy (missing)
- [X] T114 Build an accessible source-discovery admin panel showing coverage, link health, recognition confidence, review state, and explicit approval controls per FR-018 and FR-022 (partial)
- [X] T115 Add unit, persistence, API, component, security, and operations coverage for source discovery, review authorization, failure isolation, and the path toward 100 automatic companies per SC-001 and test strategy (partial)

## Notes

- `[P]` never means “use a sub-agent”; it only documents file-level independence for implementers.
- Do not modify or discard unrelated pre-existing worktree changes while executing tasks.
- Tests must not call real recruitment websites.
- Commit after each task or coherent dependency group and stop at any checkpoint for review.
- If an implementation decision changes the public contract, update `contracts/openapi.yaml`, `data-model.md`, and the affected tests in the same change.

## Phase 10: Convergence

- [X] T116 Expand the reviewed default automatic-source catalog to at least 100 companies with current mainland-China recruitment coverage, stable ATS identities, exact allowlists, and no fabricated source metadata per SC-001 (partial)
- [X] T117 Extend deterministic Moka discovery to recognize reviewed `apply` and `campus_apply` entry variants and normalize them to the existing public API adapter per FR-024 and plan: Source strategy (partial)
- [X] T118 Replace the fixed five-batch scheduled trigger with a bounded drain loop that safely covers at least 200 due sources per six-hour run and stops when the queue is exhausted per FR-003 and SC-001 (partial)
- [X] T119 Add catalog, discovery, scheduler, duplicate-identity, China-filter, and minimum-coverage regression tests without contacting real recruitment websites per Constitution II and SC-001 (partial)
- [X] T120 Update source onboarding, supported-company counts, six-hour capacity, review provenance, and scale limits in operations and architecture documentation per plan: rollout and Engineering Standards (partial)
