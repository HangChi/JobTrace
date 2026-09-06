# Release Checklist: 自动招聘岗位市场

**Reviewed**: 2026-09-06
**Branch**: `master`

## Product and Maintainability

- [x] Homepage presents one record per company recruitment campaign; titles and locations are deduplicated and merged.
- [x] Every company exposes at most one validated official HTTPS recruitment entry; underlying job targets remain traceable and unsafe entries are disabled.
- [x] Source ingestion is adapter-based and covered for Greenhouse, Lever, Ashby, SmartRecruiters, Moka, Xiaomi, and Schema.org.
- [x] Synchronization is idempotent and implements stale, closed, and reopened lifecycle transitions without deleting cached history.
- [x] Same-name legal entities remain separate unless source catalog entries explicitly share a stable company identity key.
- [x] Closed-only campaigns are hidden from ordinary browsing while remaining available in explicit closed and favorite history views.
- [x] Public recruitment data, per-user favorites, and private application snapshots have explicit module and ownership boundaries.
- [x] Operations, adapter extension, source onboarding, monitoring, secret rotation, and rollback are documented.

## Security and Privacy

- [x] Source access requires an approved HTTPS host and rejects local/private/metadata destinations before requests and after redirects, including compressed and expanded IPv4-mapped IPv6 forms.
- [x] Response type, redirect count, timeout, and body size are bounded; active source markup is never rendered.
- [x] Application links are normalized and unsafe links are not exposed as clickable UI.
- [x] Internal sync uses a secret-protected endpoint; admin source controls are role-protected.
- [x] Favorites and tracked applications remain owner-scoped; public post changes do not overwrite private snapshots.
- [x] Tests verify that UI, APIs, diagnostics, and logs do not expose credentials, cookies, raw payloads, or private application data.

## Accessibility and Performance

- [x] Axe and keyboard flows pass at 375px and 1280px for the marketplace and admin surface.
- [x] Deterministic performance data covers 100 companies and 100,000 posts/source records.
- [x] Measured p95 budgets pass: campaign read 74.96ms, filter 30.59ms, favorite write 25.51ms, concurrent claim 360.45ms.
- [x] Marketplace Web Vitals gates pass for LCP ≤2.5s, INP ≤200ms, and CLS ≤0.1.
- [x] Lighthouse assertions pass for all configured runs.

## Verification Evidence

- [x] `pnpm format`, `pnpm lint`, `pnpm typecheck`, and `pnpm build` pass.
- [x] `pnpm test` passes: 71 files / 294 tests; 92.81% line and 82.33% branch coverage.
- [x] Contract suite passes: 38/38, including partial batches and unsafe URL handling.
- [x] Integration suite passes: 42/42, including sync lifecycle, stable company identities, owner isolation, favorites, application links, admin controls, and safe logging.
- [x] Full E2E suite passes: 60/60.
- [x] `pnpm performance`, `pnpm performance:auth`, and Lighthouse gates pass.
- [x] `pnpm db`, `pnpm db:test`, `pnpm db:reset:verify`, and `pnpm db:types:check` pass.
- [x] SQL migrations and pgTAP tests are committed and CI installs pgTAP before executing them.

## Environment-specific Deviation

- [x] The configured external/local PostgreSQL used during this run does not expose the pgTAP extension, so `pnpm db:sql:test` cannot execute there. This is an environment prerequisite rather than an assertion failure: CI explicitly installs pgTAP, the remaining database reset/type/integration gates pass, and the limitation plus remediation is documented in `docs/operations.md`.

## Release Decision

- [x] Constitution review passed for maintainability, ≥80% line/branch coverage, WCAG 2.2 AA, performance budgets, safe logging, and recoverable rollback.
- [x] The release candidate is ready for CI and deployment validation. Production must still supply the sync secret, approved source allowlist/onboarding, a six-hour scheduler, a pgTAP-capable CI database, and documented alerts.
