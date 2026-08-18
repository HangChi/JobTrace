"use client";

import type { InterviewActionItem } from "../application/contracts";

export function InterviewActionItems({
  items,
  onChange,
}: {
  items: InterviewActionItem[];
  onChange: (items: InterviewActionItem[]) => void;
}) {
  return (
    <section className="interview-section stack">
      <div className="section-heading">
        <div>
          <p className="section-kicker">NEXT STEPS</p>
          <h2>下一步行动</h2>
        </div>
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
          添加行动
        </button>
      </div>
      {items.length === 0 && (
        <p className="interview-empty">把复盘结论变成一个具体行动。</p>
      )}
      <ol className="action-item-list">
        {items.map((item, index) => (
          <li key={item.id}>
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
              aria-label={`行动 ${index + 1}`}
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
              aria-label={`删除行动 ${index + 1}`}
              onClick={() =>
                onChange(items.filter((_, current) => current !== index))
              }
            >
              ×
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
