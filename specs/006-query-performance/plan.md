# Implementation Plan: 查询性能渐进优化

**Branch**: `codex/006-query-performance` | **Date**: 2026-09-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/006-query-performance/spec.md`

## Summary

在不改变用户可见契约、owner 隔离和部署架构的前提下，以可重复的完整仓储基准驱动三个增量：列表先分页后组装、分析事实单次构建、岗位市场公共摘要读模型。精确总数在同一查询快照中保留；岗位摘要与成功同步使用同一事务刷新，私人收藏仍在请求时合并。

## Technical Context

**Language/Version**: TypeScript 5.9, SQL/PLpgSQL, Python 3.12 performance harness

**Primary Dependencies**: Next.js 16 App Router, React 19, postgres.js 3.4, Zod 4

**Storage**: PostgreSQL 17

**Testing**: Vitest, Playwright integration/contract/E2E, pgTAP, isolated Python/TypeScript performance tests

**Target Platform**: Node.js 24 standalone service on Linux with PostgreSQL 17

**Project Type**: Modular monolithic web application

**Performance Goals**: Reads <=500 ms p95 at documented 10k private/100k public data scales; writes <=1 s p95

**Constraints**: Preserve exact response contracts, stable ordering, owner isolation and write atomicity; no remote push/deploy; a report may occupy at most two database query slots

**Scale/Scope**: 10,000 applications and reviews per benchmark owner; 100 companies and 100,000 public posts

## Constitution Check

*GATE: Passed before research and re-checked after design.*

- **Maintainability**: PASS. Existing repository and SQL-function boundaries are retained; no new service or runtime dependency is introduced.
- **Testing**: PASS. Each query rewrite starts with correctness/integration coverage and a representative performance case.
- **UX/accessibility**: PASS. Pagination, totals, filters, loading and empty states retain their public behavior.
- **Measured performance**: PASS. Existing 500 ms read and 1 second write budgets are retained and measured on isolated deterministic data.
- **Post-design re-check**: PASS. The read model adds one PostgreSQL table and refresh function because the 100k-post path repeatedly derives the same public company summary; refresh remains within the authoritative sync transaction and has a rollback path to normalized tables.

## Project Structure

### Documentation (this feature)

```text
specs/006-query-performance/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── modules/applications/infrastructure/postgres-application-repository.ts
├── modules/interviews/infrastructure/postgres-interview-repository.ts
├── modules/analytics/infrastructure/postgres-analytics-report.ts
└── modules/job-market/infrastructure/

tests/
├── integration/{applications,interviews,analytics,job-market}/
└── performance/

supabase/migrations/
└── 20260907000100_job_market_company_read_model.sql
```

**Structure Decision**: 保留现有模块化单体和 `app/UI → application → domain/infrastructure` 依赖方向；查询优化仅修改对应仓储、SQL 迁移和测试。

## Complexity Tracking

无宪法违例。
