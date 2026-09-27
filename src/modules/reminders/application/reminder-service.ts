import "server-only";

import { requireUser } from "@/modules/identity-access";
import { Problem } from "@/shared/errors/problem";
import {
  reminderInputSchema,
  reminderUpdateSchema,
  reopenSchema,
  snoozeSchema,
  versionSchema,
} from "./contracts";
import { validateReminderTimes } from "../domain/reminder-rules";
import { PostgresReminderRepository } from "../infrastructure/postgres-reminder-repository";

const repository = () => new PostgresReminderRepository();
const asDates = (eventAt: string, notifyAt: string) => ({
  eventAt: new Date(eventAt),
  notifyAt: new Date(notifyAt),
});

export async function getReminderSummary(
  status: "active" | "completed" | "cancelled" = "active",
) {
  const actor = await requireUser();
  return repository().list(actor.id, status);
}

export async function createReminder(input: unknown) {
  const actor = await requireUser();
  const value = reminderInputSchema.parse(input);
  const dates = asDates(value.eventAt, value.notifyAt);
  validateReminderTimes(dates.eventAt, dates.notifyAt);
  const repo = repository();
  if (value.emailEnabled && !(await repo.emailAvailability(actor.id)).available)
    throw new Problem("email_unavailable", "请先绑定并验证接收邮箱。", 400, [
      {
        field: "emailEnabled",
        code: "email_unavailable",
        message: "请先绑定并验证接收邮箱。",
      },
    ]);
  const reminder = await repo.create(actor.id, value);
  if (!reminder) throw new Problem("not_found", "没有找到这条投递。", 404);
  return reminder;
}

export async function updateReminder(id: string, input: unknown) {
  const actor = await requireUser();
  const value = reminderUpdateSchema.parse(input);
  const dates = asDates(value.eventAt, value.notifyAt);
  validateReminderTimes(dates.eventAt, dates.notifyAt);
  const repo = repository();
  if (value.emailEnabled && !(await repo.emailAvailability(actor.id)).available)
    throw new Problem("email_unavailable", "请先绑定并验证接收邮箱。", 400);
  const reminder = await repo.update(actor.id, id, value);
  if (!reminder)
    throw new Problem("conflict", "提醒已经发生变化，请刷新后重试。", 409);
  return reminder;
}

async function transition(
  id: string,
  input: unknown,
  action: "complete" | "cancel",
) {
  const actor = await requireUser();
  const { version } = versionSchema.parse(input);
  const reminder = await repository().transition(actor.id, id, version, action);
  if (!reminder)
    throw new Problem("conflict", "提醒已经发生变化，请刷新后重试。", 409);
  return reminder;
}

export const completeReminder = (id: string, input: unknown) =>
  transition(id, input, "complete");
export const cancelReminder = (id: string, input: unknown) =>
  transition(id, input, "cancel");

export async function snoozeReminder(id: string, input: unknown) {
  const actor = await requireUser();
  const value = snoozeSchema.parse(input);
  const reminder = await repository().findOwned(actor.id, id);
  if (!reminder) throw new Problem("not_found", "没有找到这条提醒。", 404);
  validateReminderTimes(
    new Date(reminder.eventAt),
    new Date(value.notifyAt),
    new Date(),
    { snooze: true },
  );
  const updated = await repository().transition(
    actor.id,
    id,
    value.version,
    "snooze",
    { notifyAt: value.notifyAt },
  );
  if (!updated)
    throw new Problem("conflict", "提醒已经发生变化，请刷新后重试。", 409);
  return updated;
}

export async function reopenReminder(id: string, input: unknown) {
  const actor = await requireUser();
  const value = reopenSchema.parse(input);
  validateReminderTimes(new Date(value.eventAt), new Date(value.notifyAt));
  const updated = await repository().transition(
    actor.id,
    id,
    value.version,
    "reopen",
    value,
  );
  if (!updated)
    throw new Problem("conflict", "提醒已经发生变化，请刷新后重试。", 409);
  return updated;
}

export async function retryReminderEmail(id: string, input: unknown) {
  const actor = await requireUser();
  const { version } = versionSchema.parse(input);
  const reminder = await repository().findOwned(actor.id, id);
  if (!reminder) throw new Problem("not_found", "没有找到这条提醒。", 404);
  if (reminder.emailStatus !== "failed")
    throw new Problem("invalid_state", "当前没有可重试的邮件。", 409);
  if (!(await repository().queueEmailRetry(actor.id, id, version)))
    throw new Problem("conflict", "提醒已经发生变化，请刷新后重试。", 409);
  return { accepted: true };
}
