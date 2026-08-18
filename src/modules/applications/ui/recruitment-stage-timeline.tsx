"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { isInterviewStage } from "@/modules/interviews/domain/catalog";
import type { ApplicationDetail } from "../application/contracts";
import {
  RECRUITMENT_STAGES,
  STATUS_LABELS,
  STAGE_LABELS,
  type ApplicationStatus,
  type RecruitmentStage,
} from "../domain/catalog";

const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });

type TimelineItem =
  | {
      id: string;
      kind: "stage";
      value: RecruitmentStage;
      occurredOn: string;
    }
  | {
      id: string;
      kind: "status";
      value: Extract<ApplicationStatus, "offer" | "refused">;
      occurredOn: string;
    };

function terminalStatus(after: unknown) {
  if (!after || typeof after !== "object") return null;
  const status = (after as { status?: unknown }).status;
  return status === "offer" || status === "refused" ? status : null;
}

export function RecruitmentStageTimeline({
  application,
  onUpdate,
}: {
  application: ApplicationDetail;
  onUpdate: (application: ApplicationDetail) => void;
}) {
  const router = useRouter();
  const [selectedStage, setSelectedStage] = useState<RecruitmentStage | null>(
    null,
  );
  const [occurredOn, setOccurredOn] = useState(today());
  const [updating, setUpdating] = useState<RecruitmentStage | null>(null);
  const [error, setError] = useState("");
  const currentStage = application.stageOccurrences.at(-1)?.stage;
  const recordedStages = new Set(
    application.stageOccurrences.map((item) => item.stage),
  );
  const selectedDateAlreadyRecorded = Boolean(
    selectedStage &&
    application.stageOccurrences.some(
      (item) => item.stage === selectedStage && item.occurredOn === occurredOn,
    ),
  );
  const selectedOccurrence = selectedStage
    ? application.stageOccurrences.findLast(
        (item) => item.stage === selectedStage,
      )
    : undefined;
  const currentTerminalStatus =
    application.status === "offer" || application.status === "refused"
      ? application.status
      : null;
  const currentStatusEvent = currentTerminalStatus
    ? application.events.find(
        (event) =>
          event.type === "status_changed" &&
          terminalStatus(event.after) === currentTerminalStatus,
      )
    : undefined;
  const timelineItems: TimelineItem[] = [
    ...application.stageOccurrences.map((item) => ({
      id: item.id,
      kind: "stage" as const,
      value: item.stage,
      occurredOn: item.occurredOn,
    })),
    ...(currentTerminalStatus && currentStatusEvent
      ? [
          {
            id: currentStatusEvent.id,
            kind: "status" as const,
            value: currentTerminalStatus,
            occurredOn: currentStatusEvent.occurredOn,
          },
        ]
      : []),
  ].sort(
    (left, right) =>
      left.occurredOn.localeCompare(right.occurredOn) ||
      (left.kind === right.kind ? 0 : left.kind === "stage" ? -1 : 1),
  );

  async function updateStage(stage: RecruitmentStage) {
    setUpdating(stage);
    setError("");
    try {
      const response = await fetch(
        `/api/applications/${application.id}/stages`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ stage, occurredOn }),
        },
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "更新招聘阶段失败，请稍后重试。");
      }
      onUpdate(result as ApplicationDetail);
      setSelectedStage(null);
      router.refresh();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "更新招聘阶段失败，请稍后重试。",
      );
    } finally {
      setUpdating(null);
    }
  }

  async function cancelStageUpdate() {
    if (!selectedOccurrence) return;
    setUpdating(selectedOccurrence.stage);
    setError("");
    try {
      const response = await fetch(
        `/api/applications/${application.id}/stages/${selectedOccurrence.id}`,
        {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ changeDate: today() }),
        },
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "取消阶段更新失败，请稍后重试。");
      }
      onUpdate(result as ApplicationDetail);
      setSelectedStage(null);
      router.refresh();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "取消阶段更新失败，请稍后重试。",
      );
    } finally {
      setUpdating(null);
    }
  }

  async function reviseStageDate() {
    if (!selectedOccurrence) return;
    setUpdating(selectedOccurrence.stage);
    setError("");
    try {
      const response = await fetch(`/api/applications/${application.id}/stages/${selectedOccurrence.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stage: selectedOccurrence.stage, occurredOn, changeDate: today() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "更新阶段日期失败。");
      onUpdate(result as ApplicationDetail);
      setSelectedStage(null);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "更新阶段日期失败。");
    } finally { setUpdating(null); }
  }

  return (
    <section className="detail-section recruitment-stage-panel">
      <div className="recruitment-stage-heading">
        <div>
          <h3>招聘阶段</h3>
          <p>点击阶段后确认日期，支持补录过去的进展</p>
        </div>
        {currentStage && (
          <span className={`stage-badge stage-${currentStage}`}>
            <i aria-hidden="true" /> 当前：{STAGE_LABELS[currentStage]}
          </span>
        )}
      </div>

      <div className="stage-picker" aria-label="更新招聘阶段">
        {RECRUITMENT_STAGES.map((stage, index) => {
          const recorded = recordedStages.has(stage);
          const isCurrent = stage === currentStage;
          return (
            <button
              type="button"
              key={stage}
              className={`${recorded ? "is-recorded" : ""} ${isCurrent ? "is-current" : ""} ${selectedStage === stage ? "is-selected" : ""}`}
              disabled={Boolean(updating)}
              aria-pressed={selectedStage === stage}
              onClick={() => {
                setSelectedStage(stage);
                if (selectedStage !== stage) {
                  setOccurredOn(
                    application.stageOccurrences.findLast((item) => item.stage === stage)?.occurredOn ?? today(),
                  );
                }
                setError("");
              }}
            >
              <span className="stage-picker-index" aria-hidden="true">
                {recorded ? "✓" : index + 1}
              </span>
              <span>{STAGE_LABELS[stage]}</span>
              {selectedStage === stage && !updating && (
                <small>{recorded ? "可取消" : "待确认"}</small>
              )}
              {updating === stage && <small>更新中</small>}
            </button>
          );
        })}
      </div>

      {selectedStage && selectedOccurrence ? (
        <div
          className="stage-cancel-confirm"
          role="group"
          aria-label="取消阶段更新"
        >
          <div className="stage-cancel-copy">
            <div>
              <span>阶段记录</span>
              <strong>{STAGE_LABELS[selectedOccurrence.stage]}</strong>
              <time dateTime={selectedOccurrence.occurredOn}>
                {selectedOccurrence.occurredOn}
              </time>
            </div>
            <p>可以修正日期；若移除阶段，关联面经会保留并解除关联。</p>
          </div>
          <label>
            发生日期
            <input type="date" value={occurredOn} min={application.appliedDate} max={today()} onChange={(event) => setOccurredOn(event.target.value)} />
          </label>
          <div className="stage-date-actions">
            <button
              type="button"
              className="button secondary"
              disabled={Boolean(updating) || occurredOn === selectedOccurrence.occurredOn}
              onClick={() => void reviseStageDate()}
            >
              保存日期
            </button>
            <button
              type="button"
              className="button secondary"
              disabled={Boolean(updating)}
              onClick={() => setSelectedStage(null)}
            >
              返回
            </button>
            <button
              type="button"
              className="button danger"
              disabled={Boolean(updating)}
              onClick={() => void cancelStageUpdate()}
            >
              {updating ? "正在取消…" : "确认取消"}
            </button>
          </div>
        </div>
      ) : selectedStage ? (
        <div
          className="stage-date-confirm"
          role="group"
          aria-label="确认阶段日期"
        >
          <div>
            <span>将阶段更新为</span>
            <strong>{STAGE_LABELS[selectedStage]}</strong>
          </div>
          <label>
            发生日期
            <input
              type="date"
              value={occurredOn}
              min={application.appliedDate}
              max={today()}
              onChange={(event) => setOccurredOn(event.target.value)}
            />
          </label>
          <div className="stage-date-actions">
            <button
              type="button"
              className="button secondary"
              disabled={Boolean(updating)}
              onClick={() => setSelectedStage(null)}
            >
              关闭
            </button>
            <button
              type="button"
              className="button"
              disabled={
                Boolean(updating) || !occurredOn || selectedDateAlreadyRecorded
              }
              onClick={() => void updateStage(selectedStage)}
            >
              {updating ? "正在更新…" : "确认更新"}
            </button>
          </div>
          {selectedDateAlreadyRecorded && (
            <p className="stage-date-hint">这个阶段在所选日期已经记录过了。</p>
          )}
        </div>
      ) : null}

      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}

      <div className="stage-timeline-wrap" aria-live="polite">
        <h4>阶段时间线</h4>
        {timelineItems.length ? (
          <ol className="stage-timeline">
            {timelineItems.map((item, index) => (
              <li
                key={`${item.kind}-${item.id}`}
                className={
                  index === timelineItems.length - 1 ? "is-latest" : ""
                }
              >
                <span
                  className={`stage-timeline-dot ${item.kind === "stage" ? `stage-${item.value}` : `timeline-status-${item.value}`}`}
                  aria-hidden="true"
                >
                  <i />
                </span>
                <strong>
                  {item.kind === "stage"
                    ? STAGE_LABELS[item.value]
                    : STATUS_LABELS[item.value]}
                </strong>
                <time dateTime={item.occurredOn}>{item.occurredOn}</time>
                {item.kind === "stage" && isInterviewStage(item.value) && (
                  <Link
                    className="stage-review-link"
                    href={`/interviews/new?applicationId=${application.id}&stageOccurrenceId=${item.id}` as Route}
                  >
                    记录面经
                  </Link>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <p className="stage-timeline-empty">
            点击上方阶段，开始记录招聘进展。
          </p>
        )}
      </div>
    </section>
  );
}
