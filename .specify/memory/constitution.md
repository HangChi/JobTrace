<!--
Sync Impact Report
- Version change: none -> 1.0.0
- Added principles:
  - I. Maintainable Code by Design
  - II. Testing Is a Release Gate
  - III. Consistent and Accessible User Experience
  - IV. Measured Performance Budgets
- Added sections:
  - Engineering Standards
  - Delivery and Review Gates
- Removed sections: none
- Follow-up TODOs: none
-->
# JobTrace Constitution

## Core Principles

### I. Maintainable Code by Design
All production code MUST be readable, cohesive, and no more complex than the requirement demands.
Modules and functions MUST have a single clear responsibility, public contracts MUST be explicit,
and names MUST reflect domain language. Duplication that encodes the same business rule MUST be
removed or deliberately justified. Error paths MUST be handled intentionally; swallowed failures,
dead code, and unexplained magic values are prohibited. Changes MUST satisfy the repository's
formatter, linter, type checker, and static-analysis rules before review. Reviewers MUST reject
unnecessary abstractions and undocumented complexity. These rules keep the system safe to change
as JobTrace grows.

### II. Testing Is a Release Gate
Every behavior change MUST be accompanied by automated tests at the lowest effective level. Unit
tests MUST cover domain rules and edge cases; integration tests MUST cover boundaries such as
storage, external services, and module contracts; critical user journeys MUST have end-to-end
coverage. A defect fix MUST include a regression test that fails without the fix. Tests MUST be
deterministic, isolated, and meaningful; disabling, weakening, or deleting a test solely to make a
pipeline pass is prohibited. All tests MUST pass before merge. Changed code MUST maintain at least
80% line coverage and 80% branch coverage unless an approved exception documents why coverage is
not a useful risk signal. Coverage is a floor, not a substitute for assertions about behavior.

### III. Consistent and Accessible User Experience
User-facing behavior MUST use shared design tokens, components, terminology, interaction patterns,
and feedback states. Every workflow MUST define loading, empty, success, validation, and failure
states where applicable. Interfaces MUST support keyboard operation, visible focus, semantic
structure, and sufficient contrast, and MUST meet WCAG 2.2 AA for applicable criteria. Responsive
behavior MUST be verified at the project's supported viewport sizes. Copy, date/time formats, and
status labels MUST remain consistent across surfaces. Any intentional departure from an established
pattern MUST be documented and approved during review. Consistency reduces user effort and prevents
accessibility from becoming an afterthought.

### IV. Measured Performance Budgets
Performance requirements MUST be stated and measured for every user-visible feature before release.
For web experiences, the 75th percentile of real-user or representative lab measurements MUST meet
Largest Contentful Paint at or below 2.5 seconds, Interaction to Next Paint at or below 200
milliseconds, and Cumulative Layout Shift at or below 0.1. User-initiated API operations MUST have
a documented latency target; unless a feature specifies a stricter target, reads MUST complete at
or below 500 milliseconds p95 and writes at or below 1 second p95 under the documented expected
load. Background work MUST not block interactive paths. Performance tests MUST use reproducible data
and environments, and a regression beyond a budget MUST block release unless an approved exception
includes impact, mitigation, owner, and expiry date.

## Engineering Standards

- The simplest design that fully satisfies the specification MUST be preferred. New dependencies,
  services, and architectural layers require a written rationale covering need, maintenance cost,
  security, and performance impact.
- Public interfaces, non-obvious decisions, setup steps, and operational constraints MUST be
  documented with the change that introduces them.
- Logs and diagnostics MUST provide enough context to investigate failures without exposing secrets
  or personal data. Secrets and environment-specific values MUST remain outside version control.
- Accessibility, performance, and testability MUST be considered in specifications and plans, not
  deferred until implementation is complete.
- Any numeric target may be made stricter by a feature specification. A looser target requires the
  exception process defined by this constitution.

## Delivery and Review Gates

1. Each feature specification MUST include acceptance criteria, relevant edge cases, accessibility
   expectations, and measurable performance targets.
2. Implementation plans MUST identify test levels, expected observability, and any risk to existing
   user experience or performance budgets.
3. Before merge, automated formatting, linting, type checking, tests, coverage gates, and applicable
   performance checks MUST pass in continuous integration.
4. Reviewers MUST verify behavior against the specification and explicitly assess all four core
   principles. Self-review alone is insufficient for production changes.
5. Exceptions MUST be recorded in the pull request or decision record with rationale, scope, risk,
   compensating controls, accountable owner, and expiry date. Expired exceptions block further
   release until resolved or renewed.
6. Releases MUST include a rollback or mitigation path proportionate to user and operational risk.

## Governance

This constitution is the highest-priority engineering policy for JobTrace. Specifications, plans,
tasks, reviews, and implementation decisions MUST comply with it. When another project document
conflicts with this constitution, this constitution governs.

Amendments require a written proposal describing the change, rationale, migration impact, and any
affected quality gates. Approval requires review by the project maintainers before merge. Material
changes MUST include a migration plan for active work and existing code where immediate compliance
is impractical.

Constitution versions follow semantic versioning: MAJOR for removal or incompatible redefinition of
a principle or governance rule, MINOR for a new principle or materially expanded obligation, and
PATCH for clarifications that do not change obligations. The Last Amended date MUST be updated for
every approved change; the original Ratified date MUST remain unchanged.

Compliance MUST be reviewed for every production change. Maintainers MUST conduct a broader
constitution review at least once per major release or every six months, whichever occurs first.
Any non-compliance MUST be corrected before release or covered by a time-bound exception under the
Delivery and Review Gates.

**Version**: 1.0.0 | **Ratified**: 2026-08-13 | **Last Amended**: 2026-08-13
