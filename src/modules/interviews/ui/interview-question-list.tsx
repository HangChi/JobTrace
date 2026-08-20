"use client";

import { useState } from "react";
import { MarkdownPreview } from "./markdown-preview";

export function InterviewQuestionList({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [mode, setMode] = useState<"edit" | "preview">("edit");

  return (
    <section className="interview-section stack">
      <div className="section-heading">
        <div>
          <p className="section-kicker">REVIEW NOTES</p>
          <h2>面经内容</h2>
          <p className="section-description">
            用 Markdown 自由记录问题、回答、复盘和下一步。
          </p>
        </div>
        <div
          className="markdown-mode-switch"
          role="tablist"
          aria-label="面经内容视图"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "edit"}
            className={mode === "edit" ? "is-active" : ""}
            onClick={() => setMode("edit")}
          >
            编辑
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "preview"}
            className={mode === "preview" ? "is-active" : ""}
            onClick={() => setMode("preview")}
          >
            预览
          </button>
        </div>
      </div>
      <div className="markdown-surface">
        {mode === "edit" ? (
          <label className="markdown-field">
            <span className="visually-hidden">编辑 Markdown</span>
            <textarea
              autoFocus
              maxLength={4000}
              value={value}
              rows={18}
              placeholder={
                "# 本轮面试\n\n## 主要问题\n- 问题与我的回答\n\n## 复盘\n- 做得好的地方\n- 可以改进的地方\n- 下一步行动"
              }
              onChange={(event) => onChange(event.target.value)}
            />
          </label>
        ) : (
          <section
            className="markdown-preview markdown-preview-single"
            aria-label="Markdown 预览"
          >
            <MarkdownPreview value={value} />
          </section>
        )}
      </div>
    </section>
  );
}
