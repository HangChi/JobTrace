# Release Checklist: 自动招聘岗位市场

**Reviewed**: 2026-08-30  
**Branch**: `codex/005-automated-job-market`

## Product and Maintainability

- [x] Homepage presents one record per company recruitment campaign; titles and locations are deduplicated and merged.
- [x] Every valid underlying post retains a selectable official HTTPS application target; unavailable or unsafe targets are disabled.
- [x] Source ingestion is adapter-based and covered for Greenhouse, Lever, Ashby, SmartRecruiters, Moka, Xiaomi, and Schema.org.
- [x] Synchronization is idempotent and implements stale, closed, and reopened lifecycle transitions without deleting cached history.
- [x] Public recruitment data, per-user favorites, and private application snapshots have explicit module and ownership boundaries.
- [x] Operations, adapter extension, source onboarding, monitoring, secret rotation, and rollback are documented.

## Security and Privacy

- [x] Source access requires an approved HTTPS host and rejects local/private/metadata destinations before requests and after redirects.
- [x] Response type, redirect count, timeout, and body size are bounded; active source markup is never rendered.
- [x] Application links are normalized and unsafe links are not exposed as clickable UI.
- [x] Internal sync uses a secret-protected endpoint; admin source controls are role-protected.
- [x] Favorites and tracked applications remain owner-scoped; public post changes do not overwrite private snapshots.
- [x] Tests verify that UI, APIs, diagnostics, and logs do not expose credentials, cookies, raw payloads, or private application data.

## Accessibility and Performance

- [x] Axe and keyboard flows pass at 375px and 1280px for the marketplace and admin surface.
- [x] Deterministic performance data covers 100 companies and 100,000 posts/source records.
- [x] Measured p95 budgets pass: campaign read 272.92ms, filter 28.74ms, favorite write 25.17ms, concurrent claim 369.95ms.
- [x] Marketplace Web Vitals gates pass for LCP ≤2.5s, INP ≤200ms, and CLS ≤0.1.
- [x] Lighthouse assertions pass for all configured runs.

## Verification Evidence

- [x] `pnpm format`, `pnpm lint`, `pnpm typecheck`, and `pnpm build` pass.
- [x] `pnpm test` passes: 60 files / 192 tests; 93.28% line and 83.65% branch coverage.
- [x] Adapter contract regression passes: 6/6, including partial batches and unsafe URL handling.
- [x] Contract and integration suites pass, including sync lifecycle, owner isolation, favorites, application links, admin controls, and safe logging.
- [x] Full E2E suite passes: 60/60.
- [x] `pnpm performance`, `pnpm performance:auth`, and Lighthouse gates pass.
- [x] `pnpm db`, `pnpm db:test`, `pnpm db:reset:verify`, and `pnpm db:types:check` pass.
- [x] SQL migrations and pgTAP tests are committed and CI installs pgTAP before executing them.

## Environment-specific Deviation

- [x] The configured external/local PostgreSQL used during this run does not expose the pgTAP extension, so `pnpm db:sql:test` cannot execute there. This is an environment prerequisite rather than an assertion failure: CI explicitly installs pgTAP, the remaining database reset/type/integration gates pass, and the limitation plus remediation is documented in `docs/operations.md`.

## Release Decision

- [x] Constitution review passed for maintainability, ≥80% line/branch coverage, WCAG 2.2 AA, performance budgets, safe logging, and recoverable rollback.
- [x] Release is ready after deployment supplies the sync secret, approved source allowlist/onboarding, a five-minute scheduler, pgTAP-capable CI database, and documented alerts.
