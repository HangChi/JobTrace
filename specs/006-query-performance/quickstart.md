# Quickstart: 查询性能渐进优化

## Prerequisites

- Node.js 24, pnpm 10, Python 3.12 and uv
- PostgreSQL 17 test server configured in `.env.local`
- The configured account can create and drop isolated test databases

## Validation

```bash
pnpm format
pnpm lint
pnpm typecheck
pnpm test
pnpm db:reset:verify
pnpm integration
pnpm performance
```

Expected outcomes:

- All migrations replay from an empty database.
- Application, interview, analytics and job-market integration contracts remain unchanged.
- Full repository performance cases return non-empty, correctly shaped data within the budgets in `contracts/query-contract.md`.
- The performance wrapper reports that its isolated database was removed.

## Local-only boundary

Do not run deployment scripts, remote synchronization commands, `git push`, or any server management command while validating this feature.
