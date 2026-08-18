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
import { InterviewQuestionList } from "./interview-question-list";
import { InterviewActionItems } from "./interview-action-items";
import { useInterviewAutosave } from "./interview-autosave";

export function InterviewEditor({ initial }: { initial: InterviewDetail }) {
  const [draft, setDraft] = useState(initial);
  const [revision, setRevision] = useState(0);
  const change = useCallback((patch: Partial<InterviewDetail>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setRevision((value) => value + 1);
  }, []);
  const payload = useMemo(
    () => ({
      version: draft.version,
      format: draft.format,
      durationMinutes: draft.durationMinutes,
      interviewerNotes: draft.interviewerNotes,
      roundResult: draft.roundResult,
      highlights: draft.highlights,
      gaps: draft.gaps,
      status: draft.status,
      questions: draft.questions,
      actionItems: draft.actionItems,
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
  const canComplete =
    draft.questions.some((item) => item.question.trim()) &&
    Boolean(
      draft.gaps?.trim() ||
      draft.actionItems.some((item) => item.content.trim()) ||
      draft.questions.some((item) => item.improvedAnswer?.trim()),
    );

  return (
    <div className="interview-editor stack">
      <header className="interview-editor-header">
        <div>
          <p className="eyebrow">
            <span aria-hidden="true" />{" "}
            {draft.linked ? "已关联招聘阶段" : "阶段已解除关联"}
          </p>
          <h1>
            {draft.companyName} · {draft.positionName}
          </h1>
          <p className="lead">
            {draft.interviewedOn} · {draft.stage}
          </p>
        </div>
        <div
          className="save-state"
          aria-live="polite"
          data-state={autosave.state}
        >
          {autosave.message || "开始编辑后自动保存"}
          {autosave.state === "error" && (
            <button type="button" onClick={() => void autosave.retry()}>
              重试
            </button>
          )}
        </div>
      </header>
      <section className="panel stack">
        <div className="section-heading">
          <div>
            <p className="section-kicker">CONTEXT</p>
            <h2>面试背景</h2>
          </div>
          <span className={`review-status status-${draft.status}`}>
            {REVIEW_STATUS_LABELS[draft.status]}
          </span>
        </div>
        <div className="grid">
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
        questions={draft.questions}
        onChange={(questions) =>
          change({
            questions,
            status:
              draft.status === "completed"
                ? "pending_review"
                : questions.length
                  ? "pending_review"
                  : "draft",
          })
        }
      />
      <section className="panel stack">
        <div>
          <p className="section-kicker">REFLECTION</p>
          <h2>整体复盘</h2>
        </div>
        <div className="answer-compare">
          <label>
            做得好的地方
            <textarea
              rows={6}
              value={draft.highlights ?? ""}
              onChange={(event) => change({ highlights: event.target.value })}
            />
          </label>
          <label>
            暴露的问题
            <textarea
              rows={6}
              value={draft.gaps ?? ""}
              onChange={(event) => change({ gaps: event.target.value })}
            />
          </label>
        </div>
      </section>
      <InterviewActionItems
        items={draft.actionItems}
        onChange={(actionItems) =>
          change({
            actionItems,
            status:
              draft.status === "completed" ? "pending_review" : draft.status,
          })
        }
      />
      <footer className="interview-editor-footer">
        <nav className="interview-editor-nav" aria-label="离开面经编辑">
          <Link className="button secondary" href="/interviews">
            返回面经列表
          </Link>
          <Link
            className="button secondary"
            href={`/applications/${draft.applicationId}`}
          >
            查看关联投递
          </Link>
        </nav>
        <button
          type="button"
          className="button"
          disabled={
            !canComplete ||
            autosave.state === "saving" ||
            autosave.state === "conflict"
          }
          onClick={() => change({ status: "completed" })}
        >
          {draft.status === "completed" ? "复盘已完成" : "完成复盘"}
        </button>
      </footer>
    </div>
  );
}
