# Data Model: Scheduled reminders

All timestamps are `timestamptz`; product input and display use `Asia/Shanghai`.

## `scheduled_reminders`

| Field | Type | Rules |
|---|---|---|
| `id` | uuid | primary key |
| `owner_id` | text | required, references user, indexed |
| `application_id` | uuid | required, references application, cascade on delete |
| `source_stage_occurrence_id` | uuid nullable | stage suggestion used to create this reminder; set null if stage is removed |
| `title` | text | trimmed, 1–120 characters |
| `event_at` | timestamptz | required |
| `notify_at` | timestamptz | required, must be `<= event_at` and future when saved/reopened |
| `email_enabled` | boolean | default false; accepted only when owner has a verified email |
| `status` | text | `pending`, `due`, `completed`, `cancelled` |
| `completed_at` | timestamptz nullable | required only for completed |
| `cancelled_at` | timestamptz nullable | required only for cancelled |
| `version` | integer | starts at 1, increments for every user-visible mutation |
| `created_at`, `updated_at` | timestamptz | audit timestamps |

Indexes:

- `(owner_id, status, notify_at, id)` for the user summary and status filters.
- `(status, notify_at, id) where status = 'pending'` for global due claiming.
- `(application_id, status)` for deletion/status-transition warnings.

Validation:

- On create/edit/reopen, `notify_at > now()` and `notify_at <= event_at`.
- Snooze requires `new_notify_at > now()` but may be after `event_at`; it intentionally preserves the original event after the event has passed.
- Completed/cancelled records never become due until explicitly reopened with a new valid time.
- Ownership is derived from the authenticated actor and verified against the application; it is never accepted from a request body.

## `reminder_notification_attempts`

| Field | Type | Rules |
|---|---|---|
| `id` | uuid | primary key |
| `reminder_id` | uuid | required, cascade on delete |
| `owner_id` | text | required for isolation and diagnostics |
| `channel` | text | first version: `email` |
| `scheduled_for` | timestamptz | the `notify_at` value this attempt belongs to |
| `status` | text | `claimed`, `sent`, `failed`, `skipped` |
| `claim_token` | uuid nullable | current worker fencing token |
| `lease_until` | timestamptz nullable | permits recovery from interrupted workers |
| `attempt_count` | integer | starts at 1; bounded retry count |
| `recipient` | text nullable | actual verified address used for this attempt |
| `error_code` | text nullable | bounded diagnostic code, no raw provider body |
| `sent_at`, `created_at`, `updated_at` | timestamptz | audit timestamps |

Unique constraint: `(reminder_id, scheduled_for, channel)`.

```text
claimed ──provider accepts──> sent
claimed ──provider fails────> failed
claimed ──lease expires─────> claimed (new token, attempt_count + 1)
failed  ──automatic/manual retry within limit──> claimed
claimed ──no verified email or reminder no longer active──> skipped
sent    ──terminal; never retried
```

## `progress_reminder_completions` extension

| Added field | Type | Rules |
|---|---|---|
| `resolution` | text | `completed`, `dismissed`, `scheduled`; old rows become `dismissed` |
| `reminder_id` | uuid nullable | points to the created reminder; set null if the reminder is later removed while preserving the resolved suggestion |
| `updated_at` | timestamptz | audit timestamp |

Unique `(owner_id, stage_occurrence_id)` remains the identity of a resolved suggestion.

## Read model

The reminder summary returned to the UI contains:

- `overdue`: due reminders and pending reminders with `notify_at <= now()` (defensive read repair).
- `upcoming`: pending reminders ordered by `notify_at`.
- `suggestions`: unresolved analytics stage suggestions.
- optional history filtered by completed/cancelled.
- current verified email availability, never another user's address.

## Reminder state transitions

```text
create ───────────────────────────────> pending
pending ──scheduler reaches notify_at─> due
pending/due ──complete───────────────> completed
pending/due ──cancel─────────────────> cancelled
due ──snooze(new notify_at)──────────> pending
completed/cancelled ──reopen─────────> pending
pending ──edit future notify_at──────> pending
```

Every user transition checks `owner_id` and expected `version`. Editing or changing state invalidates any non-sent attempt for the previous `notify_at`; already-sent history remains immutable.
