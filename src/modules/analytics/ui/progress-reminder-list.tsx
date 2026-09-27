"use client";

import { useState } from "react";
import { formatCompanyWithCity } from "@/modules/applications/application/display";
import { STAGE_LABELS } from "@/modules/applications/domain/catalog";
import type { ProgressReminder } from "../application/contracts";
import { ReminderEditorDialog } from "@/modules/reminders/ui/reminder-editor-dialog";

export function ProgressReminderList({ items }: { items: ProgressReminder[] }) {
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [completing, setCompleting] = useState<string | null>(null);
  const [error, setError] = useState("");
  const remaining = items.filter((item) => !completedIds.has(item.id));

  async function resolve(
    item: ProgressReminder,
    resolution: "completed" | "dismissed",
  ) {
    setCompleting(item.id);
    setError("");
    try {
      const response = await fetch(
        `/api/analytics/progress-reminders/${item.stageOccurrenceId}/resolve`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ resolution }),
        },
      );
      if (!response.ok) {
        const result = (await response.json()) as { message?: string };
        throw new Error(result.message || "处理建议失败，请稍后重试。");
      }
      setCompletedIds((current) => new Set(current).add(item.id));
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "处理建议失败，请稍后重试。",
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
          <h3 id="progress-reminder-title">系统建议</h3>
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
                <ReminderEditorDialog
                  application={{
                    id: item.applicationId,
                    companyName: item.companyName,
                    positionName: item.positionName,
                  }}
                  sourceStageOccurrenceId={item.stageOccurrenceId}
                  defaultTitle={`完成${STAGE_LABELS[item.stage]}后续事项`}
                  onSaved={() =>
                    setCompletedIds((current) => new Set(current).add(item.id))
                  }
                />
                <button
                  className="button secondary progress-reminder-complete"
                  type="button"
                  disabled={completing === item.id}
                  onClick={() => void resolve(item, "completed")}
                >
                  {completing === item.id ? "保存中…" : "完成"}
                </button>
                <button
                  className="button ghost progress-reminder-dismiss"
                  type="button"
                  disabled={completing === item.id}
                  onClick={() =>
                    window.confirm(
                      "关闭后，当前阶段不再显示这条建议。确定关闭吗？",
                    ) && void resolve(item, "dismissed")
                  }
                >
                  关闭建议
                </button>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
