"use client";

import { useState } from "react";
import type { ReminderPreferences } from "../application/contracts";

const leadLabels: Record<ReminderPreferences["defaultLead"], string> = {
  on_time: "事项开始时",
  "30m": "提前 30 分钟",
  "1h": "提前 1 小时",
  "1d": "提前 1 天",
};

export function ReminderSettings({
  initial,
  emailAvailable,
}: {
  initial: ReminderPreferences;
  emailAvailable: boolean;
}) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const dirty = JSON.stringify(value) !== JSON.stringify(saved);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!dirty) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/reminder-settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(value),
      });
      const result = (await response.json()) as ReminderPreferences & {
        message?: string;
      };
      if (!response.ok) throw new Error(result.message || "提醒设置保存失败。");
      setValue(result);
      setSaved(result);
      setMessage("提醒设置已保存，首页会按新选择展示。");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "提醒设置保存失败。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="reminder-settings" onSubmit={submit}>
      <div className="reminder-setting-row reminder-setting-master">
        <div>
          <strong>首页提醒卡片</strong>
          <p>首页只保留一种提醒信息，避免相同事项重复出现。</p>
        </div>
        <label className="settings-switch">
          <input
            type="checkbox"
            checked={value.homeEnabled}
            onChange={(event) =>
              setValue((current) => ({
                ...current,
                homeEnabled: event.target.checked,
              }))
            }
          />
          <span>{value.homeEnabled ? "显示" : "隐藏"}</span>
        </label>
      </div>

      <fieldset disabled={!value.homeEnabled} className="reminder-view-choice">
        <legend>首页显示哪一种</legend>
        <label className={value.homeView === "scheduled" ? "is-selected" : ""}>
          <input
            type="radio"
            name="reminder-home-view"
            value="scheduled"
            checked={value.homeView === "scheduled"}
            onChange={() =>
              setValue((current) => ({ ...current, homeView: "scheduled" }))
            }
          />
          <span>
            <strong>我的定时提醒</strong>
            <small>显示你设置了具体时间的待办</small>
          </span>
        </label>
        <label
          className={value.homeView === "suggestions" ? "is-selected" : ""}
        >
          <input
            type="radio"
            name="reminder-home-view"
            value="suggestions"
            checked={value.homeView === "suggestions"}
            onChange={() =>
              setValue((current) => ({ ...current, homeView: "suggestions" }))
            }
          />
          <span>
            <strong>系统建议</strong>
            <small>显示根据招聘阶段自动生成的建议</small>
          </span>
        </label>
      </fieldset>

      <div className="reminder-setting-grid">
        <label>
          新提醒默认时间
          <select
            value={value.defaultLead}
            onChange={(event) =>
              setValue((current) => ({
                ...current,
                defaultLead: event.target
                  .value as ReminderPreferences["defaultLead"],
              }))
            }
          >
            {Object.entries(leadLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          “稍后提醒”默认时间
          <select
            value={value.defaultSnoozeMinutes}
            onChange={(event) =>
              setValue((current) => ({
                ...current,
                defaultSnoozeMinutes: Number(
                  event.target.value,
                ) as ReminderPreferences["defaultSnoozeMinutes"],
              }))
            }
          >
            <option value={30}>30 分钟后</option>
            <option value={60}>1 小时后</option>
            <option value={1440}>明天此时</option>
          </select>
        </label>
      </div>

      <label className="reminder-setting-row reminder-email-default">
        <span className="reminder-email-copy">
          <strong>新提醒默认启用邮件</strong>
          <small>
            {emailAvailable
              ? "创建提醒时默认勾选邮件，可随时关闭。"
              : "绑定并验证邮箱后可以启用。"}
          </small>
        </span>
        <span className="reminder-email-control">
          <input
            type="checkbox"
            checked={value.emailDefault && emailAvailable}
            disabled={!emailAvailable}
            onChange={(event) =>
              setValue((current) => ({
                ...current,
                emailDefault: event.target.checked,
              }))
            }
          />
          <span className="reminder-email-track" aria-hidden="true">
            <span />
          </span>
          <span className="reminder-email-state">
            {!emailAvailable
              ? "暂不可用"
              : value.emailDefault
                ? "默认开启"
                : "默认关闭"}
          </span>
        </span>
      </label>

      <div className="profile-form-footer reminder-settings-footer">
        <div aria-live="polite">
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          {!error && message && <p className="profile-success">{message}</p>}
          {!error && !message && dirty && (
            <p className="profile-unsaved">你有尚未保存的提醒设置。</p>
          )}
        </div>
        <button className="button" disabled={!dirty || busy}>
          {busy ? "保存中…" : "保存提醒设置"}
        </button>
      </div>
    </form>
  );
}
