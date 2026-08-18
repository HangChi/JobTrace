"use client";

import { useState } from "react";
import type { InterviewQuestion } from "../application/contracts";
import { MarkdownPreview } from "./markdown-preview";

export function InterviewQuestionList({
  questions,
  onChange,
}: {
  questions: InterviewQuestion[];
  onChange: (questions: InterviewQuestion[]) => void;
}) {
  const externalMarkdown = questions.map((item) => item.question).join("\n\n");
  const [markdown, setMarkdown] = useState(externalMarkdown);
  const [mode, setMode] = useState<"edit" | "preview">("preview");

  function updateMarkdown(value: string) {
    setMarkdown(value);
    if (!value.trim()) {
      onChange([]);
      return;
    }
    const current = questions[0] ?? {
      id: crypto.randomUUID(),
      category: "other" as const,
      question: "",
      originalAnswer: null,
      followUpNotes: null,
      improvedAnswer: null,
      selfRating: null,
    };
    onChange([{ ...current, question: value }]);
  }

  return (
    <section className="interview-section stack">
      <div className="section-heading">
        <div>
          <p className="section-kicker">QUESTIONS</p>
          <h2>面试问题</h2>
        </div>
        <div
          className="markdown-mode-switch"
          role="tablist"
          aria-label="面试问题视图"
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
              required
              maxLength={4000}
              value={markdown}
              rows={12}
              placeholder={
                "# 面试问题\n\n- 问题与背景\n- 我的回答\n- 复盘后的改进"
              }
              onChange={(event) => updateMarkdown(event.target.value)}
            />
          </label>
        ) : (
          <section
            className="markdown-preview markdown-preview-single"
            aria-label="Markdown 预览"
          >
            <MarkdownPreview value={markdown} />
          </section>
        )}
      </div>
    </section>
  );
}
