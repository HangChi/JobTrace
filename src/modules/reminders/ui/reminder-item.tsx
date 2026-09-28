"use client";

import Link from "next/link";
import type { Route } from "next";
import { useState } from "react";
import type {
  Reminder,
  ReminderEmailAvailability,
} from "../application/contracts";
import {
  formatBeijingDateTime,
  parseBeijingDateTime,
  toBeijingLocalInput,
} from "../domain/reminder-rules";
import { ReminderEditorDialog } from "./reminder-editor-dialog";

function futureLocal(minutes: number) {
  return toBeijingLocalInput(new Date(Date.now() + minutes * 60_000));
}

const snoozeOptions = [
  { minutes: 30, label: "30 分钟" },
  { minutes: 60, label: "1 小时" },
  { minutes: 1440, label: "明天此时" },
] as const;

export function ReminderItem({
  reminder,
  email,
  defaultSnoozeMinutes,
  onChanged,
}: {
  reminder: Reminder;
  email: ReminderEmailAvailability;
  defaultSnoozeMinutes: 30 | 60 | 1440;
  onChanged: (reminder: Reminder) => void;
}) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [customSnoozeAt, setCustomSnoozeAt] = useState(() =>
    futureLocal(defaultSnoozeMinutes),
  );
  const [reopenEventAt, setReopenEventAt] = useState(() => futureLocal(120));
  const [reopenNotifyAt, setReopenNotifyAt] = useState(() => futureLocal(60));

  async function act(
    action: "complete" | "snooze" | "cancel" | "reopen" | "retry-email",
    override?: Record<string, unknown>,
  ) {
    setBusy(action);
    setError("");
    try {
      const body = override ?? { version: reminder.version };
      const endpoint =
        action === "cancel"
          ? `/api/reminders/${reminder.id}`
          : `/api/reminders/${reminder.id}/${action}`;
      const response = await fetch(endpoint, {
        method: action === "cancel" ? "DELETE" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as Reminder & { message?: string };
      if (!response.ok) throw new Error(result.message || "更新提醒失败。");
      if (action !== "retry-email") onChanged(result);
      else onChanged({ ...reminder, emailStatus: "claimed" });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "更新提醒失败。");
    } finally {
      setBusy("");
    }
  }

  function snooze(minutes?: number) {
    try {
      const notifyAt =
        minutes === undefined
          ? parseBeijingDateTime(customSnoozeAt)
          : new Date(Date.now() + minutes * 60_000);
      void act("snooze", {
        version: reminder.version,
        notifyAt: notifyAt.toISOString(),
      });
    } catch {
      setError("请选择有效的稍后提醒时间。");
    }
  }

  function reopen() {
    try {
      void act("reopen", {
        version: reminder.version,
        eventAt: parseBeijingDateTime(reopenEventAt).toISOString(),
        notifyAt: parseBeijingDateTime(reopenNotifyAt).toISOString(),
      });
    } catch {
      setError("请为重新打开的提醒填写有效时间。");
    }
  }

  const historical =
    reminder.status === "completed" || reminder.status === "cancelled";
  const defaultSnooze = snoozeOptions.find(
    (option) => option.minutes === defaultSnoozeMinutes,
  )!;
  return (
    <li className={`reminder-item is-${reminder.status}`}>
      <span className="company-avatar" aria-hidden="true">
        {reminder.companyName.slice(0, 1)}
      </span>
      <div className="reminder-item-copy">
        <div className="reminder-item-title-row">
          <strong>{reminder.title}</strong>
          <span className={`reminder-status-chip is-${reminder.status}`}>
            {reminder.status === "due"
              ? "已到时间"
              : reminder.status === "pending"
                ? "待处理"
                : reminder.status === "completed"
                  ? "已完成"
                  : "已取消"}
          </span>
        </div>
        <span>
          {reminder.companyName} · {reminder.positionName}
        </span>
        <div className="reminder-time-ticket">
          <span>
            <small>提醒</small>
            {formatBeijingDateTime(reminder.notifyAt)}
          </span>
          <span>
            <small>事项</small>
            {formatBeijingDateTime(reminder.eventAt)}
          </span>
        </div>
        <Link
          className="reminder-item-context-link"
          href={`/applications/${reminder.applicationId}` as Route}
        >
          查看投递详情 <span aria-hidden="true">↗</span>
        </Link>
        {reminder.emailStatus === "failed" && (
          <span className="reminder-email-error">
            邮件发送失败，站内提醒仍然有效。
          </span>
        )}
        {error && (
          <span className="field-error" role="alert">
            {error}
          </span>
        )}
      </div>
      <div className="reminder-item-actions">
        {!historical && (
          <>
            <button
              className="button"
              disabled={Boolean(busy)}
              onClick={() => void act("complete")}
            >
              完成
            </button>
            <details className="reminder-snooze-menu">
              <summary className="button secondary">稍后提醒</summary>
              <div className="reminder-snooze-popover">
                <p>选择下一次提醒时间</p>
                <div className="reminder-snooze-presets">
                  <button
                    type="button"
                    className="is-default"
                    onClick={() => snooze(defaultSnooze.minutes)}
                  >
                    {defaultSnooze.label}
                    <small>默认</small>
                  </button>
                  {snoozeOptions
                    .filter((option) => option.minutes !== defaultSnoozeMinutes)
                    .map((option) => (
                      <button
                        type="button"
                        key={option.minutes}
                        onClick={() => snooze(option.minutes)}
                      >
                        {option.label}
                      </button>
                    ))}
                </div>
                <label>
                  自定义时间
                  <input
                    type="datetime-local"
                    value={customSnoozeAt}
                    onChange={(event) => setCustomSnoozeAt(event.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => snooze()}
                >
                  使用此时间
                </button>
              </div>
            </details>
            <details className="reminder-more-menu">
              <summary aria-label="更多操作">
                <span aria-hidden="true">•••</span>
              </summary>
              <div className="reminder-more-popover">
                <ReminderEditorDialog
                  application={{
                    id: reminder.applicationId,
                    companyName: reminder.companyName,
                    positionName: reminder.positionName,
                  }}
                  email={email}
                  reminder={reminder}
                  buttonLabel="编辑提醒"
                  onSaved={onChanged}
                />
                {reminder.emailStatus === "failed" && (
                  <button
                    className="button secondary"
                    disabled={Boolean(busy)}
                    onClick={() => void act("retry-email")}
                  >
                    重试邮件
                  </button>
                )}
                <button
                  className="button ghost reminder-cancel-action"
                  disabled={Boolean(busy)}
                  onClick={() =>
                    window.confirm("取消后将不再发送这条提醒，确定取消吗？") &&
                    void act("cancel")
                  }
                >
                  取消提醒
                </button>
              </div>
            </details>
          </>
        )}
        {historical && (
          <details className="reminder-reopen">
            <summary>重新打开</summary>
            <label>
              事项时间
              <input
                type="datetime-local"
                value={reopenEventAt}
                onChange={(event) => setReopenEventAt(event.target.value)}
              />
            </label>
            <label>
              提醒时间
              <input
                type="datetime-local"
                value={reopenNotifyAt}
                onChange={(event) => setReopenNotifyAt(event.target.value)}
              />
            </label>
            <button
              className="button secondary"
              disabled={Boolean(busy)}
              onClick={reopen}
            >
              确认重新打开
            </button>
          </details>
        )}
      </div>
    </li>
  );
}
