# Job market fixtures

All automated source-adapter tests use immutable files in this directory or a
loopback mock server backed by them. Tests must never request a real company,
ATS, search engine, or recruitment aggregator domain.

Fixture families cover successful pages, pagination, missing optional fields,
multiple locations, explicit closures, malformed items, partial batches, rate
limits, unsafe URLs, redirects, unsupported content types, and response-size
limits. Every new adapter requires a contract fixture before it can be enabled.
