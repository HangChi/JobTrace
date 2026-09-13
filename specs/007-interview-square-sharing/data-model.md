# Data Model: 个人面经与面经广场

## Interview Review extensions

| Field | Type | Rules |
|-------|------|-------|
| visibility | `private \| public` | Required; default `private`; public requires completed status |
| authorMode | `anonymous \| attributed` | Required; default `anonymous`; forced anonymous while private |
| publishedAt | timestamp or null | Required for public; null for private; refreshed on private → public |

Existing ownership, application linkage, questions, status, version and cascade relationships remain unchanged.

## State transitions

| From | Request | Result |
|------|---------|--------|
| private + incomplete | public | Rejected with validation error |
| private + completed | public anonymous | public, anonymous, publishedAt=now |
| private + completed | public attributed | public, attributed, publishedAt=now |
| public | switch author mode | public, requested mode, publishedAt unchanged |
| public | private | private, anonymous, publishedAt=null |
| public + completed | status becomes incomplete | private, anonymous, publishedAt=null |
| private | ordinary content edit | sharing fields unchanged |

All transitions participate in the existing version check and increment the interview version exactly once.

## Public Author

| Field | Type | Source |
|-------|------|--------|
| username | string | `users.username`; present only for attributed publication |
| image | string or null | `users.image`; present only for attributed publication |

No display name, email, role, user ID or profile URL is exposed.

## Public Interview Summary

Contains `id`, company name, position name, stage, interview date, published time, question count, and optional Public Author. It never contains owner/application/stage-occurrence identifiers, review workflow state, round result or action counts.

## Public Interview Detail

Extends the summary with highlights, gaps and public questions. A public question contains category and question/original answer/follow-up/improved answer text only. It excludes question ID, personal rating and timestamps.

## Query model

- Public filters: `q`, `city`, `position`, `sort=latest|hot`, `cursor`, `limit`.
- Owner filters extend the existing query with `publication=private|anonymous|attributed`.
- Latest cursor uses `(publishedAt, id)` descending; hot cursor uses `(hotScore, publishedAt, id)` descending.

## Public engagement counters

`interview_reviews` stores non-negative `likeCount`, `commentCount`, and `viewCount` counters plus a generated `hotScore = likeCount × 3 + commentCount × 2 + viewCount`. Relationship-table triggers keep counters synchronized for inserts, deletes, user deletion, and review deletion.

## Interview Like

| Field | Type | Rules |
|-------|------|-------|
| interviewReviewId | uuid | References interview review; cascade delete |
| userId | text | References user; cascade delete |
| createdAt | timestamp | Server generated |

The composite `(interviewReviewId,userId)` key permits at most one like per user and review.

## Interview Comment

| Field | Type | Rules |
|-------|------|-------|
| id | uuid | Server generated primary key |
| interviewReviewId | uuid | References interview review; cascade delete |
| userId | text | References user; cascade delete |
| content | text | Trimmed, 1–1000 characters |
| createdAt | timestamp | Server generated |

Public comment output contains only id, content, createdAt, username and optional avatar.

## Interview View

| Field | Type | Rules |
|-------|------|-------|
| interviewReviewId | uuid | References interview review; cascade delete |
| userId | text | References user; cascade delete |
| viewedAt | timestamp | First detail view time |

The composite key means repeated detail opens by one user do not increase the public view count.
