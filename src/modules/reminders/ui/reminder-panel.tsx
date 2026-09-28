"use client";

import { useEffect, useState } from "react";
import type {
  Reminder,
  ReminderPreferences,
  ReminderSummary,
} from "../application/contracts";
import { ReminderItem } from "./reminder-item";

export function ReminderPanel({
  initialSummary,
  preferences,
}: {
  initialSummary: ReminderSummary;
  preferences: ReminderPreferences;
}) {
  const [summary, setSummary] = useState(initialSummary);
  const [view, setView] = useState<"active" | "completed" | "cancelled">(
    "active",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const refresh = () => {
      void fetch("/api/reminders", { cache: "no-store" })
        .then(async (response) => {
          if (!response.ok) throw new Error();
          setSummary((await response.json()) as ReminderSummary);
          setView("active");
        })
        .catch(() => setError("提醒已保存，但列表刷新失败，请稍后重试。"));
    };
    window.addEventListener("jobtrace:reminders-changed", refresh);
    return () =>
      window.removeEventListener("jobtrace:reminders-changed", refresh);
  }, []);

  function changed(next: Reminder) {
    setSummary((current) => {
      const all = [...current.overdue, ...current.upcoming, ...current.history]
        .filter((item) => item.id !== next.id)
        .concat(next);
      const now = new Date();
      return {
        ...current,
        overdue: all.filter(
          (item) =>
            item.status === "due" ||
            (item.status === "pending" && new Date(item.notifyAt) <= now),
        ),
        upcoming: all.filter(
          (item) => item.status === "pending" && new Date(item.notifyAt) > now,
        ),
        history: all.filter(
          (item) => item.status === "completed" || item.status === "cancelled",
        ),
      };
    });
  }

  async function switchView(next: typeof view) {
    setView(next);
    if (next === "active") return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/reminders?status=${next}`, {
        cache: "no-store",
      });
      const result = (await response.json()) as ReminderSummary & {
        message?: string;
      };
      if (!response.ok) throw new Error(result.message || "加载提醒失败。");
      setSummary((current) => ({ ...current, history: result.history }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "加载提醒失败。");
    } finally {
      setLoading(false);
    }
  }

  const groups =
    view === "active"
      ? [
          { key: "overdue", title: "已到时间", items: summary.overdue },
          { key: "upcoming", title: "接下来", items: summary.upcoming },
        ]
      : [
          {
            key: "history",
            title: view === "completed" ? "已完成" : "已取消",
            items: summary.history,
          },
        ];

  return (
    <section
      className="panel reminder-panel"
      aria-labelledby="reminder-panel-title"
    >
      <div className="panel-heading reminder-panel-heading">
        <div>
          <h3 id="reminder-panel-title">提醒与待办</h3>
          <p>按计划处理每一条求职进展</p>
        </div>
        <span className="follow-up-count">
          {summary.overdue.length + summary.upcoming.length}
        </span>
      </div>
      <div className="reminder-tabs" role="tablist" aria-label="提醒状态">
        {(["active", "completed", "cancelled"] as const).map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={view === item}
            onClick={() => void switchView(item)}
          >
            {item === "active"
              ? "待处理"
              : item === "completed"
                ? "已完成"
                : "已取消"}
          </button>
        ))}
      </div>
      {loading && (
        <p className="muted" aria-live="polite">
          正在加载提醒…
        </p>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {!loading && groups.every((group) => !group.items.length) && (
        <p className="reminder-empty">
          暂无
          {view === "active"
            ? "待处理提醒，可从投递详情设置。"
            : "相关提醒记录。"}
        </p>
      )}
      {groups.map(
        (group) =>
          group.items.length > 0 && (
            <div className="reminder-group" key={group.key}>
              <h4>
                {group.title}
                <span>{group.items.length}</span>
              </h4>
              <ul className="reminder-list">
                {group.items.map((item) => (
                  <ReminderItem
                    key={item.id}
                    reminder={item}
                    email={summary.email}
                    defaultSnoozeMinutes={preferences.defaultSnoozeMinutes}
                    onChanged={changed}
                  />
                ))}
              </ul>
            </div>
          ),
      )}
    </section>
  );
}
