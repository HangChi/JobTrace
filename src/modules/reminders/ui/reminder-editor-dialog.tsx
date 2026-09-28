"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Dialog } from "@/shared/ui/dialog";
import type {
  Reminder,
  ReminderEmailAvailability,
  ReminderPreferences,
} from "../application/contracts";
import {
  calculateNotifyAt,
  formatBeijingDateTime,
  parseBeijingDateTime,
  toBeijingLocalInput,
  type ReminderLead,
} from "../domain/reminder-rules";

type ApplicationContext = {
  id: string;
  companyName: string;
  positionName: string;
};

function defaultEventValue() {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60_000);
  tomorrow.setMinutes(0, 0, 0);
  tomorrow.setHours(tomorrow.getHours() + 1);
  return toBeijingLocalInput(tomorrow);
}

export function ReminderEditorDialog({
  application,
  email,
  reminder,
  sourceStageOccurrenceId,
  defaultTitle = "跟进招聘进度",
  buttonLabel = "设置提醒",
  onSaved,
}: {
  application: ApplicationContext;
  email?: ReminderEmailAvailability;
  reminder?: Reminder;
  sourceStageOccurrenceId?: string;
  defaultTitle?: string;
  buttonLabel?: string;
  onSaved?: (reminder: Reminder) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(reminder?.title ?? defaultTitle);
  const [eventAt, setEventAt] = useState(
    reminder ? toBeijingLocalInput(reminder.eventAt) : defaultEventValue(),
  );
  const [lead, setLead] = useState<ReminderLead>(reminder ? "custom" : "1h");
  const [customNotifyAt, setCustomNotifyAt] = useState(
    reminder ? toBeijingLocalInput(reminder.notifyAt) : "",
  );
  const [emailEnabled, setEmailEnabled] = useState(
    reminder?.emailEnabled ?? false,
  );
  const [resolvedEmail, setResolvedEmail] = useState<ReminderEmailAvailability>(
    email ?? { available: false, address: null },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const notification = useMemo(() => {
    try {
      if (lead === "custom")
        return customNotifyAt ? parseBeijingDateTime(customNotifyAt) : null;
      return calculateNotifyAt(parseBeijingDateTime(eventAt), lead);
    } catch {
      return null;
    }
  }, [customNotifyAt, eventAt, lead]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!notification) {
      setError("请选择有效的提醒时间。");
      return;
    }
    setBusy(true);
    try {
      const body = {
        applicationId: application.id,
        sourceStageOccurrenceId:
          reminder?.sourceStageOccurrenceId ?? sourceStageOccurrenceId ?? null,
        title,
        eventAt: parseBeijingDateTime(eventAt).toISOString(),
        notifyAt: notification.toISOString(),
        emailEnabled,
        ...(reminder ? { version: reminder.version } : {}),
      };
      const response = await fetch(
        reminder ? `/api/reminders/${reminder.id}` : "/api/reminders",
        {
          method: reminder ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const result = (await response.json()) as Reminder & { message?: string };
      if (!response.ok) throw new Error(result.message || "保存提醒失败。");
      onSaved?.(result);
      window.dispatchEvent(new Event("jobtrace:reminders-changed"));
      setOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "保存提醒失败。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="button secondary reminder-open-button"
        onClick={() => {
          setOpen(true);
          if (!reminder) {
            void Promise.all([
              email
                ? Promise.resolve({ email })
                : fetch("/api/reminders", { cache: "no-store" }).then(
                    (response) => response.json(),
                  ),
              fetch("/api/reminder-settings", { cache: "no-store" }).then(
                (response) => response.json(),
              ),
            ])
              .then(([summary, preferences]) => {
                const nextEmail = summary.email as ReminderEmailAvailability;
                const nextPreferences = preferences as ReminderPreferences;
                if (nextEmail) setResolvedEmail(nextEmail);
                if (nextPreferences.defaultLead)
                  setLead(nextPreferences.defaultLead);
                setEmailEnabled(
                  Boolean(nextPreferences.emailDefault && nextEmail?.available),
                );
              })
              .catch(() => undefined);
          }
        }}
      >
        {buttonLabel}
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        kicker="求职待办"
        title={reminder ? "编辑提醒" : "设置提醒"}
        description={`${application.companyName} · ${application.positionName}`}
        className="reminder-editor-dialog"
      >
        <form className="reminder-editor" onSubmit={submit}>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <label>
            待办内容
            <input
              required
              maxLength={120}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <label>
            事项时间
            <input
              required
              type="datetime-local"
              value={eventAt}
              onChange={(event) => setEventAt(event.target.value)}
            />
          </label>
          <label>
            提醒我
            <select
              value={lead}
              onChange={(event) => setLead(event.target.value as ReminderLead)}
            >
              <option value="on_time">准时</option>
              <option value="30m">提前 30 分钟</option>
              <option value="1h">提前 1 小时</option>
              <option value="1d">提前 1 天</option>
              <option value="custom">自定义时间</option>
            </select>
          </label>
          {lead === "custom" && (
            <label>
              自定义提醒时间
              <input
                required
                type="datetime-local"
                value={customNotifyAt}
                onChange={(event) => setCustomNotifyAt(event.target.value)}
              />
            </label>
          )}
          <fieldset className="reminder-channels">
            <legend>通知方式</legend>
            <div className="reminder-channel-options">
              <label className="reminder-channel-option is-active">
                <input type="checkbox" checked disabled />
                <span>
                  <strong>站内提醒</strong>
                  <small>始终开启</small>
                </span>
              </label>
              <label
                className={`reminder-channel-option${
                  emailEnabled ? " is-active" : ""
                }${!resolvedEmail.available ? " is-disabled" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={emailEnabled}
                  disabled={!resolvedEmail.available}
                  onChange={(event) => setEmailEnabled(event.target.checked)}
                />
                <span>
                  <strong>邮件提醒</strong>
                  <small>{resolvedEmail.address ?? "尚未绑定邮箱"}</small>
                </span>
              </label>
            </div>
            {!resolvedEmail.available && (
              <p className="reminder-channel-note">
                要接收邮件，请先<Link href="/profile">绑定并验证邮箱</Link>。
              </p>
            )}
          </fieldset>
          <p className="reminder-preview" role="status">
            {notification
              ? `将于 ${formatBeijingDateTime(notification)} 提醒（北京时间）`
              : "选择时间后会在这里显示实际通知时间。"}
          </p>
          <div className="reminder-editor-actions">
            <button
              type="button"
              className="button secondary"
              onClick={() => setOpen(false)}
            >
              取消
            </button>
            <button type="submit" className="button" disabled={busy}>
              {busy ? "保存中…" : "保存提醒"}
            </button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
