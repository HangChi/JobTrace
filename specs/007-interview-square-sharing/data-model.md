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

- Public filters: `q`, `stage[]`, `interviewedFrom`, `interviewedTo`, `cursor`, `limit`.
- Owner filters extend the existing query with `publication=private|anonymous|attributed`.
- Public ordering cursor uses `(publishedAt, id)` descending.
