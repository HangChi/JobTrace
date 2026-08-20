"use client";

import { useState } from "react";
import { formatCompanyWithCity } from "@/modules/applications/application/display";
import { STAGE_LABELS } from "@/modules/applications/domain/catalog";
import type { ProgressReminder } from "../application/contracts";

export function ProgressReminderList({ items }: { items: ProgressReminder[] }) {
  const [remaining, setRemaining] = useState(items);
  const [completing, setCompleting] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function complete(item: ProgressReminder) {
    setCompleting(item.id);
    setError("");
    try {
      const response = await fetch(
        `/api/analytics/progress-reminders/${item.stageOccurrenceId}/complete`,
        { method: "POST" },
      );
      if (!response.ok) {
        const result = (await response.json()) as { message?: string };
        throw new Error(result.message || "完成提醒失败，请稍后重试。");
      }
      setRemaining((current) =>
        current.filter((value) => value.id !== item.id),
      );
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "完成提醒失败，请稍后重试。",
      );
    } finally {
      setCompleting(null);
    }
  }

  if (!remaining.length) return null;
  return (
    <section
      className="panel progress-reminder-panel"
      aria-labelledby="progress-reminder-title"
    >
      <div className="panel-heading">
        <div>
          <p className="section-kicker">ACTION NEEDED</p>
          <h3 id="progress-reminder-title">待处理进展</h3>
        </div>
        <span className="follow-up-count">{remaining.length}</span>
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <ul className="progress-reminder-list">
        {remaining.map((item) => {
          const company = formatCompanyWithCity(item.companyName, item.city);
          return (
            <li key={item.id} className="progress-reminder-item">
              <span className="company-avatar" aria-hidden="true">
                {item.companyName.slice(0, 1)}
              </span>
              <span className="progress-reminder-detail">
                <strong>{company}</strong>
                <span className="table-subline">
                  {item.positionName}
                  <span className="progress-reminder-date">
                    · {item.occurredOn}
                  </span>
                </span>
              </span>
              <span className={`progress-reminder-stage stage-${item.stage}`}>
                {STAGE_LABELS[item.stage]}
              </span>
              <span className="progress-reminder-actions">
                <button
                  className="button secondary progress-reminder-complete"
                  type="button"
                  disabled={completing === item.id}
                  onClick={() => void complete(item)}
                >
                  {completing === item.id ? "保存中…" : "不再提醒"}
                </button>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
