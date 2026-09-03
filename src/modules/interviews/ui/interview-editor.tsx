"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import type { InterviewDetail } from "../application/contracts";
import {
  INTERVIEW_FORMATS,
  INTERVIEW_FORMAT_LABELS,
  REVIEW_STATUS_LABELS,
  ROUND_RESULTS,
  ROUND_RESULT_LABELS,
} from "../domain/catalog";
import { STAGE_LABELS } from "@/modules/applications/domain/catalog";
import { InterviewQuestionList } from "./interview-question-list";
import { useInterviewAutosave } from "./interview-autosave";
import { interviewToMarkdown } from "../application/interview-markdown";

export function InterviewEditor({ initial }: { initial: InterviewDetail }) {
  const [draft, setDraft] = useState(initial);
  const [markdown, setMarkdown] = useState(() => interviewToMarkdown(initial));
  const [revision, setRevision] = useState(0);
  const [completionError, setCompletionError] = useState("");
  const change = useCallback((patch: Partial<InterviewDetail>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setRevision((value) => value + 1);
  }, []);
  const payload = useMemo(
    () => ({
      version: draft.version,
      interviewedOn: draft.interviewedOn,
      format: draft.format,
      durationMinutes: draft.durationMinutes,
      interviewerNotes: draft.interviewerNotes,
      roundResult: draft.roundResult,
      highlights: draft.highlights,
      gaps: draft.gaps,
      status: draft.status,
      questions: draft.questions.filter((item) => item.question.trim()),
      actionItems: draft.actionItems.filter((item) => item.content.trim()),
    }),
    [draft],
  );
  const onSaved = useCallback((value: InterviewDetail) => {
    // Keep the locally edited fields and caret position; autosave only returns
    // the server version needed for the next optimistic-concurrency update.
    setDraft((current) => ({ ...current, version: value.version }));
  }, []);
  const autosave = useInterviewAutosave({
    id: draft.id,
    revision,
    payload,
    onSaved,
  });
  const canComplete = Boolean(markdown.trim());

  return (
    <div className="interview-editor stack">
      <header className="interview-editor-header">
        <div>
          <p className="eyebrow">
            {draft.linked ? "已关联招聘阶段" : "阶段已解除关联"}
          </p>
          <h1>
            {draft.companyName} · {draft.positionName}
          </h1>
          <p className="lead">
            {draft.interviewedOn} · {STAGE_LABELS[draft.stage]}
          </p>
        </div>
        <div className="save-state-region" aria-live="polite">
          {autosave.state !== "idle" && (
            <div className="save-state" data-state={autosave.state}>
              <span className="save-state-mark" aria-hidden="true">
                {autosave.state === "saved" ? "✓" : ""}
              </span>
              <span>{autosave.message}</span>
              {autosave.state === "error" && (
                <button type="button" onClick={() => void autosave.retry()}>
                  重试
                </button>
              )}
              {autosave.state === "conflict" && (
                <button type="button" onClick={() => window.location.reload()}>
                  刷新页面
                </button>
              )}
            </div>
          )}
        </div>
      </header>
      <section className="panel stack">
        <div className="section-heading">
          <div>
            <h2>面试背景</h2>
          </div>
          <span className={`review-status status-${draft.status}`}>
            {REVIEW_STATUS_LABELS[draft.status]}
          </span>
        </div>
        <div className="grid">
          <label>
            面试 / 测评日期
            <input
              type="date"
              value={draft.interviewedOn}
              onChange={(event) =>
                change({ interviewedOn: event.target.value })
              }
              required
            />
          </label>
          <label>
            面试形式
            <span className="select-wrap">
              <select
                value={draft.format ?? ""}
                onChange={(event) =>
                  change({
                    format:
                      (event.target.value as InterviewDetail["format"]) || null,
                  })
                }
              >
                <option value="">未记录</option>
                {INTERVIEW_FORMATS.map((format) => (
                  <option key={format} value={format}>
                    {INTERVIEW_FORMAT_LABELS[format]}
                  </option>
                ))}
              </select>
              <svg aria-hidden="true" viewBox="0 0 16 16">
                <path d="m4.5 6.25 3.5 3.5 3.5-3.5" />
              </svg>
            </span>
          </label>
          <label>
            时长（分钟）
            <input
              type="number"
              min="1"
              max="600"
              value={draft.durationMinutes ?? ""}
              onChange={(event) =>
                change({
                  durationMinutes: event.target.value
                    ? Number(event.target.value)
                    : null,
                })
              }
            />
          </label>
          <label>
            本轮结果
            <span className="select-wrap">
              <select
                value={draft.roundResult}
                onChange={(event) =>
                  change({
                    roundResult: event.target
                      .value as InterviewDetail["roundResult"],
                  })
                }
              >
                {ROUND_RESULTS.map((result) => (
                  <option key={result} value={result}>
                    {ROUND_RESULT_LABELS[result]}
                  </option>
                ))}
              </select>
              <svg aria-hidden="true" viewBox="0 0 16 16">
                <path d="m4.5 6.25 3.5 3.5 3.5-3.5" />
              </svg>
            </span>
          </label>
        </div>
      </section>
      <InterviewQuestionList
        value={markdown}
        onChange={(value) => {
          setMarkdown(value);
          change({
            questions: value.trim()
              ? [
                  {
                    id: draft.questions[0]?.id ?? crypto.randomUUID(),
                    category: "other",
                    question: value,
                    originalAnswer: null,
                    followUpNotes: null,
                    improvedAnswer: null,
                    selfRating: null,
                  },
                ]
              : [],
            highlights: null,
            gaps: null,
            actionItems: [],
            status:
              draft.status === "completed"
                ? "pending_review"
                : value.trim()
                  ? "pending_review"
                  : "draft",
          });
        }}
      />
      <footer className="interview-editor-footer">
        <nav className="interview-editor-nav" aria-label="离开面经编辑">
          <Link
            className="button secondary"
            href="/interviews"
            onClick={() => void autosave.flush()}
          >
            返回面经列表
          </Link>
          <Link
            className="button secondary"
            href={`/applications/${draft.applicationId}`}
            onClick={() => void autosave.flush()}
          >
            查看关联投递
          </Link>
        </nav>
        <div className="completion-actions">
          {completionError && (
            <p className="field-error" role="alert">
              {completionError}
            </p>
          )}
          <button
            type="button"
            className="button"
            disabled={
              autosave.state === "saving" || autosave.state === "conflict"
            }
            onClick={() => {
              if (!canComplete) {
                setCompletionError("请先填写面经内容，再完成复盘。");
                return;
              }
              setCompletionError("");
              change({ status: "completed" });
            }}
          >
            {draft.status === "completed" ? "复盘已完成" : "完成复盘"}
          </button>
        </div>
      </footer>
    </div>
  );
}
