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
  const [publicationNotice, setPublicationNotice] = useState("");
  const change = useCallback((patch: Partial<InterviewDetail>) => {
    setDraft((current) => {
      const next = { ...current, ...patch };
      if (next.status !== "completed") {
        next.visibility = "private";
        next.authorMode = "anonymous";
        next.publishedAt = null;
      } else if (next.visibility === "private") {
        next.authorMode = "anonymous";
        next.publishedAt = null;
      }
      return next;
    });
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
      visibility: draft.visibility,
      authorMode: draft.authorMode,
      questions: draft.questions.filter((item) => item.question.trim()),
      actionItems: draft.actionItems.filter((item) => item.content.trim()),
    }),
    [draft],
  );
  const onSaved = useCallback((value: InterviewDetail) => {
    // Keep the locally edited fields and caret position; autosave only returns
    // the server version needed for the next optimistic-concurrency update.
    setDraft((current) => ({
      ...current,
      version: value.version,
      status: value.status,
      visibility: value.visibility,
      authorMode: value.authorMode,
      publishedAt: value.publishedAt,
    }));
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
          if (draft.visibility === "public") {
            setPublicationNotice(
              "内容已进入待复盘状态，这篇面经将自动从面经广场下架。",
            );
          }
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
      <section className="panel stack interview-publication-settings">
        <div className="section-heading">
          <div>
            <h2>分享设置</h2>
            <p className="section-description" id="publication-help">
              默认仅自己可见。公开后仅分享公司、岗位、轮次、日期和面经正文；投递关联、面试官备注、行动项与个人评分不会公开。
            </p>
          </div>
          <span
            className={`publication-status publication-${draft.visibility}-${draft.authorMode}`}
          >
            {draft.visibility === "private"
              ? "私有"
              : draft.authorMode === "anonymous"
                ? "匿名公开"
                : "署名公开"}
          </span>
        </div>
        <fieldset aria-describedby="publication-help">
          <legend>谁可以看到这篇面经</legend>
          <label className="publication-option">
            <input
              type="radio"
              name="visibility"
              checked={draft.visibility === "private"}
              onChange={() =>
                change({ visibility: "private", authorMode: "anonymous" })
              }
            />
            <span>
              <strong>仅自己可见</strong>
              <small>不会出现在面经广场。</small>
            </span>
          </label>
          <label className="publication-option">
            <input
              type="radio"
              name="visibility"
              checked={draft.visibility === "public"}
              disabled={draft.status !== "completed"}
              onChange={() => {
                setPublicationNotice("");
                change({ visibility: "public", authorMode: "anonymous" });
              }}
            />
            <span>
              <strong>公开到面经广场</strong>
              <small>
                {draft.status === "completed"
                  ? "所有已登录用户可阅读脱敏内容。"
                  : "完成复盘后才能公开。"}
              </small>
            </span>
          </label>
        </fieldset>
        {draft.visibility === "public" && (
          <fieldset>
            <legend>作者展示</legend>
            <label className="publication-option">
              <input
                type="radio"
                name="authorMode"
                checked={draft.authorMode === "anonymous"}
                onChange={() => change({ authorMode: "anonymous" })}
              />
              <span>
                <strong>匿名发布</strong>
                <small>广场不会返回或展示你的账号信息。</small>
              </span>
            </label>
            <label className="publication-option">
              <input
                type="radio"
                name="authorMode"
                checked={draft.authorMode === "attributed"}
                onChange={() => change({ authorMode: "attributed" })}
              />
              <span>
                <strong>署名发布</strong>
                <small>只展示头像和用户名。</small>
              </span>
            </label>
          </fieldset>
        )}
        {draft.publishedAt && (
          <p className="muted">
            当前版本已发布：
            <time dateTime={draft.publishedAt}>
              {new Date(draft.publishedAt).toLocaleString("zh-CN")}
            </time>
          </p>
        )}
        {publicationNotice && (
          <p className="field-help" role="status">
            {publicationNotice}
          </p>
        )}
      </section>
      <footer className="interview-editor-footer">
        <nav className="interview-editor-nav" aria-label="离开面经编辑">
          <Link
            className="button secondary"
            href="/interviews/mine"
            onClick={() => void autosave.flush()}
          >
            返回个人面经
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
