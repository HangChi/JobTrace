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

export function ReminderItem({
  reminder,
  email,
  onChanged,
}: {
  reminder: Reminder;
  email: ReminderEmailAvailability;
  onChanged: (reminder: Reminder) => void;
}) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [snoozePreset, setSnoozePreset] = useState("30");
  const [customSnoozeAt, setCustomSnoozeAt] = useState(() => futureLocal(30));
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

  function snooze() {
    try {
      const notifyAt =
        snoozePreset === "custom"
          ? parseBeijingDateTime(customSnoozeAt)
          : new Date(Date.now() + Number(snoozePreset) * 60_000);
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
  return (
    <li className={`reminder-item is-${reminder.status}`}>
      <span className="company-avatar" aria-hidden="true">
        {reminder.companyName.slice(0, 1)}
      </span>
      <div className="reminder-item-copy">
        <strong>{reminder.title}</strong>
        <span>
          {reminder.companyName} · {reminder.positionName}
        </span>
        <span>
          事项 {formatBeijingDateTime(reminder.eventAt)} · 提醒{" "}
          {formatBeijingDateTime(reminder.notifyAt)}
        </span>
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
        <Link
          className="button ghost"
          href={`/applications/${reminder.applicationId}` as Route}
        >
          查看投递
        </Link>
        {!historical && (
          <>
            <button
              className="button"
              disabled={Boolean(busy)}
              onClick={() => void act("complete")}
            >
              完成
            </button>
            <label className="reminder-inline-control">
              <span className="visually-hidden">稍后提醒时间</span>
              <select
                value={snoozePreset}
                disabled={Boolean(busy)}
                onChange={(event) => setSnoozePreset(event.target.value)}
              >
                <option value="30">30 分钟后</option>
                <option value="60">1 小时后</option>
                <option value="1440">明天此时</option>
                <option value="custom">自定义</option>
              </select>
            </label>
            {snoozePreset === "custom" && (
              <label className="reminder-inline-control">
                <span className="visually-hidden">自定义稍后提醒时间</span>
                <input
                  type="datetime-local"
                  value={customSnoozeAt}
                  onChange={(event) => setCustomSnoozeAt(event.target.value)}
                />
              </label>
            )}
            <button
              className="button secondary"
              disabled={Boolean(busy)}
              onClick={snooze}
            >
              {snoozePreset === "30" ? "稍后 30 分钟" : "稍后提醒"}
            </button>
            <ReminderEditorDialog
              application={{
                id: reminder.applicationId,
                companyName: reminder.companyName,
                positionName: reminder.positionName,
              }}
              email={email}
              reminder={reminder}
              buttonLabel="编辑"
              onSaved={onChanged}
            />
            <button
              className="button ghost"
              disabled={Boolean(busy)}
              onClick={() =>
                window.confirm("取消后将不再发送这条提醒，确定取消吗？") &&
                void act("cancel")
              }
            >
              取消
            </button>
            {reminder.emailStatus === "failed" && (
              <button
                className="button secondary"
                disabled={Boolean(busy)}
                onClick={() => void act("retry-email")}
              >
                重试邮件
              </button>
            )}
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
