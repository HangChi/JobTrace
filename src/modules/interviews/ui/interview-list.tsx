"use client";

import Link from "next/link";
import type { Route } from "next";
import { useState } from "react";
import type { InterviewPage } from "../application/contracts";
import { REVIEW_STATUS_LABELS, ROUND_RESULT_LABELS } from "../domain/catalog";
import { STAGE_LABELS } from "@/modules/applications/domain/catalog";
import { DownloadIcon } from "@/shared/ui/action-icons";
import { SelectionCheckbox } from "@/shared/ui/selection-checkbox";
import { DeleteInterviewDialog } from "./delete-interview-dialog";

function exportHref(ids: string[]) {
  const params = new URLSearchParams();
  ids.forEach((id) => params.append("id", id));
  return `/api/exports/interviews?${params.toString()}`;
}

export function InterviewList({
  page,
  nextHref,
}: {
  page: InterviewPage;
  nextHref: string | null;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  if (!page.items.length)
    return (
      <section className="panel interview-empty-state">
        <p className="section-kicker">INTERVIEW NOTES</p>
        <h2>还没有面经</h2>
        <p>从已有投递选择一次面试或测评，记录问题和复盘。</p>
        <Link className="button" href={"/interviews/new" as Route}>
          记录面经
        </Link>
      </section>
    );
  const currentPageIds = page.items.map((item) => item.id);
  const allSelected = currentPageIds.every((id) => selectedIds.has(id));
  const someSelected = currentPageIds.some((id) => selectedIds.has(id));

  function togglePage(checked: boolean) {
    setSelectedIds(checked ? new Set(currentPageIds) : new Set());
  }

  function toggleItem(id: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  return (
    <section className="panel interview-list-panel">
      <div className="section-heading">
        <div>
          <p className="section-kicker">INTERVIEW ARCHIVE</p>
          <h2>面经记录</h2>
        </div>
        <div className="interview-list-heading-meta">
          <div className="interview-page-selection">
            <SelectionCheckbox
              checked={allSelected}
              indeterminate={someSelected && !allSelected}
              label={`选择当前页全部 ${currentPageIds.length} 篇面经`}
              onChange={togglePage}
            />
            <span>选择当前页</span>
          </div>
          <span className="muted">共 {page.total} 篇</span>
        </div>
      </div>
      {selectedIds.size > 0 && (
        <div className="bulk-selection-bar interview-selection-bar">
          <div className="bulk-selection-count" aria-live="polite">
            <strong>{selectedIds.size}</strong>
            <span>篇面经已选择</span>
          </div>
          <div className="bulk-selection-actions">
            <button
              type="button"
              className="bulk-clear-selection"
              onClick={() => setSelectedIds(new Set())}
            >
              取消选择
            </button>
            <a
              className="button secondary interview-bulk-export"
              href={exportHref([...selectedIds])}
            >
              <DownloadIcon />
              <span>
                {selectedIds.size === 1 ? "导出 Markdown" : "导出 ZIP"}
              </span>
            </a>
          </div>
        </div>
      )}
      <ol className="interview-list">
        {page.items.map((item) => (
          <li
            key={item.id}
            className={selectedIds.has(item.id) ? "is-selected" : undefined}
          >
            <SelectionCheckbox
              checked={selectedIds.has(item.id)}
              label={`选择 ${item.companyName} ${item.positionName} ${STAGE_LABELS[item.stage]}面经`}
              onChange={(checked) => toggleItem(item.id, checked)}
            />
            <time dateTime={item.interviewedOn}>{item.interviewedOn}</time>
            <div className="interview-list-main">
              <Link href={`/interviews/${item.id}` as Route}>
                <strong>
                  {item.companyName} · {item.positionName}
                </strong>
              </Link>
              <p>
                {STAGE_LABELS[item.stage]} · {item.questionCount} 个问题 ·{" "}
                {item.actionCount} 个行动
              </p>
            </div>
            <span className={`review-status status-${item.status}`}>
              {REVIEW_STATUS_LABELS[item.status]}
            </span>
            <span className={`round-result result-${item.roundResult}`}>
              {ROUND_RESULT_LABELS[item.roundResult]}
            </span>
            <div className="interview-list-actions">
              <a
                className="table-action"
                href={exportHref([item.id])}
                aria-label={`导出 ${item.companyName} ${item.positionName} ${STAGE_LABELS[item.stage]}面经 Markdown`}
              >
                <DownloadIcon />
                <span>导出</span>
              </a>
              <DeleteInterviewDialog
                id={item.id}
                name={`${item.companyName} · ${item.positionName} · ${STAGE_LABELS[item.stage]}`}
                onDeleted={() =>
                  setSelectedIds((current) => {
                    const next = new Set(current);
                    next.delete(item.id);
                    return next;
                  })
                }
              />
            </div>
          </li>
        ))}
      </ol>
      {nextHref && (
        <div className="pagination">
          <Link className="button secondary" href={nextHref as Route}>
            下一页
          </Link>
        </div>
      )}
    </section>
  );
}
