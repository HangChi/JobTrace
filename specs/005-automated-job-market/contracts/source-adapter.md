# Source Adapter Contract

## Purpose

Each adapter converts one approved external recruitment source into the same normalized batch. Adapters never write the database and never decide cross-source identity; the sync application service owns persistence, deduplication and lifecycle transitions.

## Input

`fetch(source, context, signal) -> NormalizedSourceBatch`

- `source`: id, adapter, company identity, external key, approved HTTPS base URL, exact allowed hosts, access basis, ETag/Last-Modified.
- `context`: sync run id, current timestamp and bounded page/item limits.
- `signal`: mandatory cancellation/timeout signal.

The adapter must use the shared secure HTTP client. It must not read browser sessions, application user cookies or unrelated environment secrets.

## Output

```text
NormalizedSourceBatch
├── completeness: complete | partial
├── sourceMetadata: etag?, lastModified?, fetchedAt
├── jobs[]
│   ├── externalJobId
│   ├── title
│   ├── locations[]
│   ├── campaignName?, campaignKeyHint?, batchLabel?
│   ├── recruitmentType?, target?, education?
│   ├── descriptionText?
│   ├── detailUrl?, applyUrl?
│   ├── publishedAt?, validThrough?
│   └── sourceStatus: open | closed | unknown
└── rejected[]
    ├── externalJobId?
    ├── reasonCode
    └── safeSummary
```

## Guarantees

- `externalJobId` and `title` are non-empty and bounded; if a source lacks an id, the adapter supplies a deterministic source-local key from whitelisted normalized fields.
- URLs are absolute HTTPS and have passed shared public-host validation; unsafe links become null and generate a rejection/warning, never a clickable string.
- Locations preserve all values and remote status. Missing facts remain null; adapters do not infer education, dates, recruitment type or company identity.
- `descriptionText` is plain text. HTML, scripts, event handlers and tracking markup are never returned.
- A fully traversed authoritative response returns `complete`. Pagination truncation, isolated invalid pages/items or non-authoritative responses return `partial`, which prevents missing-record lifecycle progression.
- One invalid item is appended to `rejected` and does not invalidate otherwise valid jobs.

## Error taxonomy

Adapters throw typed errors with safe codes: `source_timeout`, `source_rate_limited`, `source_unauthorized`, `source_forbidden`, `source_not_found`, `source_unavailable`, `unsafe_source_url`, `response_too_large`, `unsupported_content_type`, `invalid_source_payload`, `pagination_limit`, `aborted`.

Raw bodies, authorization headers, tokens, cookies, query secrets and personal contact data must not appear in messages or logs. Rate-limit errors may include a bounded retry-after duration.

## Adapter-specific fixtures

Every adapter contract suite includes: normal multi-page data, multiple locations, missing optional fields, closed/reopened jobs, duplicate ids, rate limit, timeout, malformed item, unsafe apply URL, oversized response and partial pagination. Fixtures are local and immutable; tests never call production source domains.
