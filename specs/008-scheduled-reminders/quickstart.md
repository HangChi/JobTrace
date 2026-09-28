# Quickstart: Scheduled reminders validation

## Prerequisites

- Configure the existing local PostgreSQL test environment.
- Set a test `REMINDER_DELIVERY_SECRET` with at least 32 characters.
- For real email validation, run `deploy/mail-adapter` with SMTP test credentials and point `AUTH_EMAIL_DELIVERY_URL` to `/deliver`. Unit and integration tests must use a stub and must not contact SMTP.
- Apply migrations and regenerate database types using the repository scripts.

## Automated validation

```bash
pnpm typecheck
pnpm lint
pnpm test:unit -- tests/unit/reminders tests/component/reminders
pnpm contract
pnpm integration
pnpm e2e -- tests/e2e/reminders.spec.ts
(cd deploy/mail-adapter && python3 -m unittest test_app.py)
pnpm build
```

Expected: all commands pass without real external email delivery. Changed code maintains the constitution coverage floor.

## Scenario 1: Create and edit a reminder

1. Sign in as a normal user and create an application.
2. Open its detail dialog and choose “设置提醒”.
3. Set an event for tomorrow 14:00 and choose “提前 1 小时”.
4. Confirm the preview says tomorrow 13:00 Beijing time, save, and reopen the editor.
5. Move the event to 15:00.

Expected: reminder is upcoming, final notification becomes 14:00, only the latest version remains active, and no other user can read it.

## Scenario 2: Email eligibility

1. With no verified email, open the reminder editor.
2. Verify email is disabled and the binding link is available; save an in-app reminder.
3. Bind and verify an email, reopen the editor, enable email and save.

Expected: the current verified address is shown. The request cannot choose a different recipient or owner.

## Scenario 3: Due delivery and idempotency

1. Create an email-enabled reminder with `notifyAt` at or before the controlled test clock.
2. Call `POST /api/internal/reminders/deliver` twice, including two concurrent calls.
3. Inspect reminder and attempt records.

Expected: reminder is `due`; exactly one attempt identity exists for the scheduled time and channel; at most one accepted email is recorded; both scheduler responses are bounded and contain no email body or secret.

## Scenario 4: Email failure fallback and retry

1. Configure the stub mail service to fail.
2. Trigger delivery.
3. Open the reminder panel and choose email retry after restoring the stub.

Expected: reminder remains due and visible; failure is understandable; retry changes the attempt to sent without creating a duplicate email identity.

## Scenario 5: Complete and snooze

1. For one due reminder select “完成”.
2. For another choose “稍后提醒 30 分钟”.
3. Invoke the scheduler at both the old and new notification times.

Expected: completed reminder never sends again. Snoozed reminder returns to pending, keeps the original event time, does not send at the old time and becomes due at the new time.

## Scenario 6: Existing system suggestions

1. Prepare three unresolved stage suggestions.
2. Complete one, dismiss one with confirmation, and convert one to a scheduled reminder.
3. Add a new stage to the dismissed application.

Expected: all three original suggestions disappear for distinct reasons; the converted item appears once as a reminder; the new stage can create a new suggestion; pre-feature resolution rows remain dismissed and do not reappear.

## Scenario 7: Application lifecycle and accessibility

1. Change an application with an active reminder to Offer or refused and choose whether to keep/complete it.
2. Start deleting another application and inspect the reminder warning; cancel once, then confirm.
3. Complete the editor, panel, confirmation, snooze and retry flows using only the keyboard and an accessibility scan.

Expected: no reminder is silently removed on status change; deletion cancels reminders only after confirmation; focus, labels, errors and live status meet WCAG 2.2 AA.

## Scenario 8: Reminder preferences and single home view

1. Open profile reminder settings and select “我的定时提醒”, a one-hour creation lead, a 30-minute snooze default, and the desired email default; save.
2. Open the applications dashboard with both scheduled reminders and unresolved system suggestions.
3. Expand one “稍后提醒” action.
4. Return to settings, switch the home view to “系统建议”, save, and reload the dashboard.

Expected: the first dashboard view shows only scheduled reminders; the snooze menu contains one 30-minute option marked as default; the second dashboard view shows only system suggestions. Hiding the home reminder card removes both types.

## Operational validation

- Configure a one-minute external scheduler for the internal delivery endpoint using the runtime secret; never place the secret in logs or version control.
- Alert on consecutive scheduler failures, oldest pending due age above two minutes, claimed attempts with expired leases, and elevated email failure rate.
- Rollback: stop the external scheduler first, disable reminder email delivery, then roll back application code. Keep reminder tables so pending user data is not lost.
