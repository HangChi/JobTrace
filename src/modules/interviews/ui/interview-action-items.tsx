"use client";

import { useState } from "react";
import type { InterviewActionItem } from "../application/contracts";

type DeletedAction = { item: InterviewActionItem; index: number };

function move<T>(items: T[], from: number, to: number) {
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function InterviewActionItems({
  items,
  onChange,
}: {
  items: InterviewActionItem[];
  onChange: (items: InterviewActionItem[]) => void;
}) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [deleted, setDeleted] = useState<DeletedAction | null>(null);

  function remove(index: number) {
    setDeleted({ item: items[index], index });
    onChange(items.filter((_, current) => current !== index));
    setConfirming(null);
  }

  return (
    <section className="interview-section stack">
      <div className="section-heading">
        <div>
          <p className="section-kicker">NEXT STEPS</p>
          <h2>下一步行动</h2>
        </div>
        <span className="action-progress">
          {items.filter((item) => item.completed).length}/{items.length} 已完成
        </span>
        <button
          type="button"
          className="button secondary"
          onClick={() =>
            onChange([
              ...items,
              { id: crypto.randomUUID(), content: "", completed: false },
            ])
          }
        >
          添加任务
        </button>
      </div>
      {!items.length && (
        <p className="interview-empty">把复盘结论变成一个具体行动。</p>
      )}
      <ol className="action-item-list">
        {items.map((item, index) => (
          <li key={item.id}>
            <span className="action-item-index" aria-hidden="true">
              {index + 1}
            </span>
            <input
              aria-label={`完成行动 ${index + 1}`}
              type="checkbox"
              checked={item.completed}
              onChange={(event) =>
                onChange(
                  items.map((value, current) =>
                    current === index
                      ? { ...value, completed: event.target.checked }
                      : value,
                  ),
                )
              }
            />
            <input
              type="text"
              aria-label={`任务 ${index + 1}`}
              maxLength={1000}
              placeholder="写下一个具体、可执行的任务"
              className={item.completed ? "is-completed" : ""}
              value={item.content}
              onChange={(event) =>
                onChange(
                  items.map((value, current) =>
                    current === index
                      ? { ...value, content: event.target.value }
                      : value,
                  ),
                )
              }
            />
            <button
              type="button"
              aria-label={`上移行动 ${index + 1}`}
              disabled={index === 0}
              onClick={() => onChange(move(items, index, index - 1))}
            >
              ↑
            </button>
            <button
              type="button"
              aria-label={`下移行动 ${index + 1}`}
              disabled={index === items.length - 1}
              onClick={() => onChange(move(items, index, index + 1))}
            >
              ↓
            </button>
            {confirming === item.id ? (
              <>
                <button
                  type="button"
                  className="danger-link"
                  aria-label={`确认删除行动 ${index + 1}`}
                  onClick={() => remove(index)}
                >
                  确认
                </button>
                <button type="button" onClick={() => setConfirming(null)}>
                  取消
                </button>
              </>
            ) : (
              <button
                type="button"
                aria-label={`删除行动 ${index + 1}`}
                onClick={() => setConfirming(item.id)}
              >
                ×
              </button>
            )}
          </li>
        ))}
      </ol>
      {deleted && (
        <p className="undo-notice" role="status">
          已删除一个行动项。
          <button
            type="button"
            aria-label="撤销删除行动"
            onClick={() => {
              const next = [...items];
              next.splice(deleted.index, 0, deleted.item);
              onChange(next);
              setDeleted(null);
            }}
          >
            撤销
          </button>
        </p>
      )}
    </section>
  );
}
