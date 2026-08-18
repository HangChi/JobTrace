"use client";

import {
  QUESTION_CATEGORIES,
  QUESTION_CATEGORY_LABELS,
} from "../domain/catalog";
import type { InterviewQuestion } from "../application/contracts";

export function InterviewQuestionList({
  questions,
  onChange,
}: {
  questions: InterviewQuestion[];
  onChange: (questions: InterviewQuestion[]) => void;
}) {
  function patch(index: number, value: Partial<InterviewQuestion>) {
    onChange(
      questions.map((item, current) =>
        current === index ? { ...item, ...value } : item,
      ),
    );
  }
  function move(index: number, offset: number) {
    const target = index + offset;
    if (target < 0 || target >= questions.length) return;
    const next = [...questions];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }
  return (
    <section className="interview-section stack">
      <div className="section-heading">
        <div>
          <p className="section-kicker">QUESTIONS</p>
          <h2>面试问题</h2>
        </div>
        <button
          type="button"
          className="button secondary"
          onClick={() =>
            onChange([
              ...questions,
              {
                id: crypto.randomUUID(),
                category: "other",
                question: "",
                originalAnswer: null,
                followUpNotes: null,
                improvedAnswer: null,
                selfRating: null,
              },
            ])
          }
        >
          添加问题
        </button>
      </div>
      {questions.length === 0 && (
        <p className="interview-empty">
          还没有问题记录，从最有印象的一题开始。
        </p>
      )}
      {questions.map((item, index) => (
        <article className="interview-question" key={item.id}>
          <header>
            <strong>问题 {index + 1}</strong>
            <div className="question-actions">
              <button
                type="button"
                aria-label="上移问题"
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                aria-label="下移问题"
                disabled={index === questions.length - 1}
                onClick={() => move(index, 1)}
              >
                ↓
              </button>
              <button
                type="button"
                aria-label="删除问题"
                onClick={() =>
                  onChange(questions.filter((_, current) => current !== index))
                }
              >
                ×
              </button>
            </div>
          </header>
          <div className="grid">
            <label>
              分类
              <select
                value={item.category}
                onChange={(event) =>
                  patch(index, {
                    category: event.target
                      .value as InterviewQuestion["category"],
                  })
                }
              >
                {QUESTION_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {QUESTION_CATEGORY_LABELS[category]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              自我评分
              <select
                value={item.selfRating ?? ""}
                onChange={(event) =>
                  patch(index, {
                    selfRating: event.target.value
                      ? Number(event.target.value)
                      : null,
                  })
                }
              >
                <option value="">未评分</option>
                {[1, 2, 3, 4, 5].map((rating) => (
                  <option key={rating} value={rating}>
                    {rating} 分
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            问题
            <textarea
              required
              value={item.question}
              rows={2}
              onChange={(event) =>
                patch(index, { question: event.target.value })
              }
            />
          </label>
          <div className="answer-compare">
            <label>
              当时怎么回答
              <textarea
                value={item.originalAnswer ?? ""}
                rows={5}
                onChange={(event) =>
                  patch(index, { originalAnswer: event.target.value })
                }
              />
            </label>
            <label>
              复盘后的更好回答
              <textarea
                value={item.improvedAnswer ?? ""}
                rows={5}
                onChange={(event) =>
                  patch(index, { improvedAnswer: event.target.value })
                }
              />
            </label>
          </div>
          <label>
            追问或面试官反馈
            <textarea
              value={item.followUpNotes ?? ""}
              rows={3}
              onChange={(event) =>
                patch(index, { followUpNotes: event.target.value })
              }
            />
          </label>
        </article>
      ))}
    </section>
  );
}
