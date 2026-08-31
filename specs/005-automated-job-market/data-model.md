# Data Model: 自动招聘岗位市场

## Design rules

- 公共岗位与用户私人投递使用不同表和仓储；只有显式关联表连接两者。
- 所有时间使用 `timestamptz`，主键使用 UUID，枚举用受约束文本或 PostgreSQL enum。
- 来源配置只保存公开标识和访问约束；秘密仅在运行环境中保存。
- 不保存任意原始 HTML、脚本、Cookie、简历或非必要招聘联系人个人信息。
- 删除公共岗位采用状态迁移而非物理删除，以保护收藏、投递关联和审计。

## Entities

### `job_market_companies`

招聘主体，不仅凭显示名称判定相同公司。

| Field | Type | Rules |
|---|---|---|
| `id` | uuid | PK |
| `canonical_name` | text | required, 1–200 chars |
| `normalized_name` | text | required, indexed |
| `aliases` | text[] | default empty |
| `company_type` | text nullable | source-provided only |
| `industry` | text nullable | source-provided only |
| `website_url` | text nullable | validated HTTPS |
| `identity_key` | text | unique; admin/source identity, not display name alone |
| `created_at`, `updated_at` | timestamptz | required |

### `job_market_sources`

一个可独立同步的公开或授权入口。

| Field | Type | Rules |
|---|---|---|
| `id` | uuid | PK |
| `company_id` | uuid | FK company, required |
| `adapter` | text | `greenhouse`, `lever`, `ashby`, `smartrecruiters`, `schema_org` |
| `external_key` | text | tenant/board identifier; unique with adapter |
| `base_url` | text | HTTPS, required |
| `allowed_hosts` | text[] | non-empty exact host allowlist |
| `is_official` | boolean | default true |
| `access_basis` | text | `public` or `authorized` |
| `status` | text | `active`, `paused`, `revoked` |
| `sync_interval_minutes` | integer | 60–1440, default 360 |
| `next_sync_at` | timestamptz | indexed claim schedule |
| `lease_until`, `leased_by` | timestamptz/text nullable | multi-instance claim |
| `consecutive_failures` | integer | non-negative |
| `last_attempt_at`, `last_success_at` | timestamptz nullable | health display |
| `etag`, `last_modified` | text nullable | conditional fetch metadata, bounded length |
| `created_at`, `updated_at` | timestamptz | required |

Unique: `(adapter, external_key, company_id)`. Revoked sources are never scheduled; reactivation requires explicit admin authorization update.

### `job_market_campaigns`

首页聚合单位，代表“企业 + 招聘活动/批次”。

| Field | Type | Rules |
|---|---|---|
| `id` | uuid | PK |
| `company_id` | uuid | FK company |
| `campaign_key` | text | stable, source-derived/auditable |
| `name` | text nullable | explicit source campaign name |
| `recruitment_type` | text nullable | e.g. campus, experienced, internship |
| `batch_label` | text nullable | source-provided |
| `status` | text | derived `open`, `stale`, `closed` |
| `listing_kind` | text | `synced_jobs` or `recruitment_directory`; directory entries contain no collected jobs |
| `official_apply_url` | text nullable | only when one safe campaign-wide URL exists |
| `published_at`, `valid_through` | timestamptz nullable | min/max source facts, no guessing |
| `last_confirmed_at` | timestamptz nullable | latest successful observation |
| `created_at`, `updated_at` | timestamptz | required |

Unique: `(company_id, campaign_key)`. Status is `open` if any child post is open, else `stale` if any is stale, else `closed`.

### `job_market_posts`

规范公共岗位主记录。

| Field | Type | Rules |
|---|---|---|
| `id` | uuid | PK |
| `company_id`, `campaign_id` | uuid | required FKs |
| `title`, `normalized_title` | text | required; title 1–300 chars |
| `description_text` | text nullable | sanitized plain text, bounded |
| `recruitment_type`, `target`, `education` | text nullable | only source facts |
| `status` | text | `open`, `stale`, `closed` |
| `primary_apply_url` | text nullable | validated public HTTPS |
| `published_at`, `valid_through` | timestamptz nullable | source facts |
| `first_seen_at`, `last_seen_at` | timestamptz | required |
| `missing_since`, `last_missing_success_at` | timestamptz nullable | lifecycle confirmation |
| `content_hash` | text | normalized SHA-256 |
| `created_at`, `updated_at` | timestamptz | required |

Indexes: campaign/status, company/status, published date, normalized title search. `company_id` must match the referenced campaign company (enforced in transaction/compound FK design).

### `job_market_locations` and `job_market_post_locations`

Locations are many-to-many so a post keeps every valid location and remote option.

- `job_market_locations`: `id`, `normalized_key` unique, `display_name`, optional `country`, `region`, `city`, `is_remote`.
- `job_market_post_locations`: composite PK `(post_id, location_id)`; indexes reversed for filtering.

### `job_market_source_records`

Provenance of a post as observed at one source.

| Field | Type | Rules |
|---|---|---|
| `source_id` | uuid | FK source |
| `external_job_id` | text | stable source identity |
| `post_id` | uuid | FK canonical post |
| `external_detail_url`, `external_apply_url` | text nullable | validated HTTPS |
| `payload_hash` | text | normalized SHA-256 |
| `normalized_snapshot` | jsonb | whitelisted normalized fields only |
| `status` | text | `observed`, `missing`, `closed`, `rejected` |
| `first_seen_at`, `last_seen_at` | timestamptz | required |
| `last_seen_run_id` | uuid nullable | FK sync run |

Primary/unique key: `(source_id, external_job_id)`. Index canonical URLs by company context for conservative cross-source matching.

### `job_market_sync_runs`

One attempt for one source.

| Field | Type | Rules |
|---|---|---|
| `id` | uuid | PK |
| `source_id` | uuid | FK source |
| `trigger` | text | `scheduled`, `admin` |
| `status` | text | `running`, `succeeded`, `partial`, `failed` |
| `started_at`, `finished_at` | timestamptz | finish nullable while running |
| `discovered_count`, `created_count`, `updated_count`, `stale_count`, `closed_count`, `rejected_count` | integer | non-negative, default 0 |
| `error_code`, `error_summary` | text nullable | safe/PII-free, bounded |
| `request_id`, `worker_id` | text | correlation, indexed |

Runs are append-only except completing a running record. Retention may archive old runs, but explanation events remain.

### `job_market_events`

Append-only explanation log: `id`, `post_id`, `campaign_id`, `source_id`, `sync_run_id`, `event_type` (`created`, `updated`, `stale`, `closed`, `reopened`, `merged`, `primary_changed`, `rejected`), `reason_code`, whitelisted `change_summary` JSONB, `created_at`.

### `job_market_campaign_favorites`

Private relation with composite PK `(owner_id, campaign_id)` and `created_at`. Every query requires `owner_id` from the authenticated session; it is never accepted from request JSON.

### `application_job_market_links`

Private link between an existing application and its source public post.

| Field | Type | Rules |
|---|---|---|
| `application_id` | uuid | PK/FK private application, cascade on application delete |
| `owner_id` | text/uuid | required, indexed, must equal application owner |
| `post_id` | uuid | FK public post, retained after close |
| `source_record_id` | composite/uuid nullable | selected provenance |
| `job_title_snapshot`, `company_name_snapshot`, `location_snapshot`, `apply_url_snapshot` | text | immutable user-confirmed snapshot |
| `created_at` | timestamptz | required |

Unique `(owner_id, post_id)` prevents duplicate tracking. Public queries never join this table except for the current user's `alreadyTrackedApplicationId` projection.

## Relationships

```text
Company 1 ── * Source 1 ── * SourceRecord * ── 1 PublicPost
   │                                      │
   └── 1 ── * Campaign 1 ── * PublicPost * ── * Location
                    │              │
                    │              └── * ApplicationJobMarketLink ── 1 PrivateApplication
                    └── * CampaignFavorite (scoped by owner)

SyncRun 1 ── * Event * ── PublicPost/Campaign/Source
```

## Normalization and deduplication

1. Upsert exact `(source_id, external_job_id)`.
2. Within the same verified company, compare canonical HTTPS detail/apply URL.
3. If no stable match, compare an exact fingerprint of company identity, campaign key, normalized title and sorted normalized locations.
4. Ambiguous or fuzzy candidates remain separate and are logged for review; display name alone never merges companies.
5. Prefer an official source as primary; retain all source records and switch primary without changing canonical post id.

## State transitions

### Source

```text
active ──admin pause──> paused ──admin enable──> active
active/paused ──authorization revoked──> revoked
revoked ──new explicit authorization──> active
```

Only `active` sources are claimed. Failures increase backoff but do not silently mark authorization revoked.

### Sync run

```text
running ──all valid──> succeeded
running ──some records isolated──> partial
running ──fetch/batch failure──> failed
```

### Public post

```text
new observation ──> open
open ──1st successful full-snapshot absence──> stale
stale ──2nd absence ≥6h later──> closed
open/stale ──explicit close or expired deadline──> closed
stale/closed ──observed again──> open (reopened event)
```

Failed or partial source runs do not advance absence transitions. Campaign status is recomputed transactionally from child posts.

## Required indexes and constraints

- Source claim partial index on `(next_sync_at)` where `status='active'` plus `lease_until`.
- Campaign browsing indexes on `(status, last_confirmed_at desc, id)` and `(company_id, campaign_key)`.
- Post indexes on `(campaign_id, status)`, `(company_id, normalized_title)`, `published_at`, and location reverse lookup.
- PostgreSQL trigram/search index for user keyword matching across company/campaign/post title; exact normalized fields remain authoritative for identity.
- Favorite index `(owner_id, created_at desc)`.
- Link unique `(owner_id, post_id)` and FK/transaction check for matching application owner.
- Counts non-negative; URLs null or safe HTTPS; timestamps satisfy `finished_at >= started_at` and `valid_through >= published_at` when both exist.
