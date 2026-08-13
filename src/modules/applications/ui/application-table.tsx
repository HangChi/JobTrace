"use client";

import Link from "next/link";
import type { Route } from "next";
import { useState } from "react";
import { Dialog } from "@/shared/ui/dialog";
import { DismissibleDetails } from "@/shared/ui/dismissible-details";
import { DeleteApplicationDialog } from "./delete-application-dialog";
import { EditApplicationDialog } from "./application-dialogs";
import { RecruitmentStageTimeline } from "./recruitment-stage-timeline";
import { ApplicationStatusSelect } from "./application-status-select";
import type {
  ApplicationDetail,
  ApplicationPage,
  ApplicationSummary,
} from "../application/contracts";
import { STAGE_LABELS, STATUS_LABELS } from "../domain/catalog";

function latestStage(item: ApplicationSummary) {
  return item.stages.at(-1);
}

function jobLinkLabel(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "职位链接";
  }
}

type Search = Record<string, string | string[] | undefined>;
const PAGE_SIZES = ["10", "20", "50", "100"] as const;

function pageHref(query: Search, pageNumber: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (["cursor", "history", "page"].includes(key)) continue;
    if (Array.isArray(value)) value.forEach((item) => params.append(key, item));
    else if (value) params.set(key, value);
  }
  if (pageNumber > 1) params.set("page", String(pageNumber));
  return `/?${params.toString()}#application-list-title` as Route;
}

function paginationItems(current: number, total: number) {
  const pages = new Set([1, total, current - 1, current, current + 1]);
  const visible = [...pages]
    .filter((page) => page >= 1 && page <= total)
    .sort((a, b) => a - b);
  const result: Array<number | "ellipsis"> = [];
  visible.forEach((page, index) => {
    if (index > 0 && page - visible[index - 1] > 1) result.push("ellipsis");
    result.push(page);
  });
  return result;
}

function pageSizeHref(query: Search, limit: string) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (["cursor", "history", "page", "limit"].includes(key)) continue;
    if (Array.isArray(value)) value.forEach((item) => params.append(key, item));
    else if (value) params.set(key, value);
  }
  params.set("limit", limit);
  return `/?${params.toString()}#application-list-title` as Route;
}

export function ApplicationTable({
  page,
  query = {},
}: {
  page: ApplicationPage;
  query?: Search;
}) {
  const [selected, setSelected] = useState<ApplicationSummary | null>(null);
  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [editing, setEditing] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const pageSize =
    typeof query.limit === "string" &&
    PAGE_SIZES.includes(query.limit as (typeof PAGE_SIZES)[number])
      ? query.limit
      : "10";
  const pageNumber = page.page;
  const totalPages = Math.max(1, Math.ceil(page.total / page.limit));

  async function openDetail(item: ApplicationSummary) {
    setSelected(item);
    setDetail(null);
    setError("");
    setLoading(true);
    try {
      const response = await fetch(`/api/applications/${item.id}`);
      if (!response.ok) throw new Error("暂时无法加载详情");
      setDetail(await response.json());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "暂时无法加载详情");
    } finally {
      setLoading(false);
    }
  }

  async function openEditor(item: ApplicationSummary) {
    setError("");
    try {
      const response = await fetch(`/api/applications/${item.id}`);
      if (!response.ok) throw new Error("暂时无法加载投递信息");
      setEditing(await response.json());
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "暂时无法加载投递信息",
      );
    }
  }

  return (
    <section
      className="panel application-list-panel"
      aria-labelledby="application-list-title"
    >
      <div className="section-heading">
        <div>
          <h2 id="application-list-title">投递记录</h2>
          <p className="table-hint">点击任意记录可在当前页查看详情</p>
        </div>
        <span className="record-count">共 {page.total} 条</span>
      </div>
      <div className="table-wrap">
        <table className="application-table">
          <colgroup>
            <col className="company-column" />
            <col className="link-column" />
            <col className="stage-column" />
            <col className="status-column" />
            <col className="date-column" />
            <col className="actions-column" />
          </colgroup>
          <thead>
            <tr>
              <th>公司与岗位</th>
              <th>投递链接</th>
              <th>阶段</th>
              <th>状态</th>
              <th>投递日期</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {page.items.map((item) => {
              const stage = latestStage(item);
              return (
                <tr
                  key={item.id}
                  className="application-row"
                  tabIndex={0}
                  aria-label={`查看 ${item.companyName} ${item.positionName} 详情`}
                  onClick={(event) => {
                    if (
                      !(event.target as HTMLElement).closest(
                        "a, button, select, input",
                      )
                    ) {
                      void openDetail(item);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (
                      (event.target as HTMLElement).closest(
                        "a, button, select, input",
                      )
                    )
                      return;
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      void openDetail(item);
                    }
                  }}
                >
                  <td className="application-name-cell" data-label="公司与岗位">
                    <strong title={item.companyName}>{item.companyName}</strong>
                    <span className="table-subline" title={item.positionName}>
                      {item.positionName}
                    </span>
                  </td>
                  <td data-label="投递链接">
                    {item.jobUrl ? (
                      <a
                        className="job-link"
                        href={item.jobUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`打开 ${item.companyName} 的投递链接`}
                      >
                        <span className="job-link-label">
                          {jobLinkLabel(item.jobUrl)}
                        </span>
                        <span aria-hidden="true">↗</span>
                      </a>
                    ) : (
                      <span className="table-placeholder">未填写</span>
                    )}
                  </td>
                  <td data-label="阶段">
                    {stage ? (
                      <span className={`stage-badge stage-${stage}`}>
                        <i aria-hidden="true" /> {STAGE_LABELS[stage]}
                      </span>
                    ) : (
                      <span className="stage-badge stage-none">
                        <i aria-hidden="true" /> 尚未开始
                      </span>
                    )}
                  </td>
                  <td data-label="状态">
                    <ApplicationStatusSelect application={item} />
                    {item.needsFollowUp && (
                      <span className="follow-up">
                        {item.followUpReason === "timeline"
                          ? `时间线 ${item.followUpDays} 天未更新`
                          : `投递记录 ${item.followUpDays} 天未更新`}
                      </span>
                    )}
                  </td>
                  <td data-label="投递日期">{item.appliedDate}</td>
                  <td data-label="操作">
                    <div className="table-actions">
                      <button
                        className="table-action"
                        type="button"
                        onClick={() => void openEditor(item)}
                      >
                        编辑
                      </button>
                      <DeleteApplicationDialog
                        compact
                        id={item.id}
                        name={`${item.companyName} · ${item.positionName}`}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <nav className="table-pagination" aria-label="投递记录分页">
        <div className="page-size-control">
          <span>每页显示</span>
          <DismissibleDetails className="page-size-menu">
            <summary aria-label={`每页显示 ${pageSize} 条，打开选项`}>
              <strong>{pageSize}</strong>
              <span>条</span>
              <svg aria-hidden="true" viewBox="0 0 16 16">
                <path d="m4.5 6.25 3.5 3.5 3.5-3.5" />
              </svg>
            </summary>
            <div className="page-size-options" aria-label="每页显示条数">
              {PAGE_SIZES.map((size) => (
                <Link
                  key={size}
                  className={size === pageSize ? "is-current" : ""}
                  href={pageSizeHref(query, size)}
                  scroll={false}
                  aria-current={size === pageSize ? "true" : undefined}
                >
                  <span>{size} 条</span>
                  {size === pageSize && <span aria-hidden="true">✓</span>}
                </Link>
              ))}
            </div>
          </DismissibleDetails>
        </div>
        <div>
          {pageNumber > 1 ? (
            <Link
              className="pagination-link"
              href={pageHref(query, pageNumber - 1)}
              aria-label="上一页"
              scroll={false}
            >
              <span aria-hidden="true">‹</span>
            </Link>
          ) : (
            <span
              className="pagination-link is-disabled"
              aria-label="已是第一页"
            >
              ‹
            </span>
          )}
          <div className="pagination-pages">
            {paginationItems(pageNumber, totalPages).map((item, index) =>
              item === "ellipsis" ? (
                <span
                  className="pagination-ellipsis"
                  key={`ellipsis-${index}`}
                  aria-hidden="true"
                >
                  …
                </span>
              ) : item === pageNumber ? (
                <span
                  className="pagination-page is-current"
                  key={item}
                  aria-current="page"
                >
                  {item}
                </span>
              ) : (
                <Link
                  className="pagination-page"
                  href={pageHref(query, item)}
                  key={item}
                  aria-label={`第 ${item} 页`}
                  scroll={false}
                >
                  {item}
                </Link>
              ),
            )}
          </div>
          {pageNumber < totalPages ? (
            <Link
              className="pagination-link"
              href={pageHref(query, pageNumber + 1)}
              aria-label="下一页"
              scroll={false}
            >
              <span aria-hidden="true">›</span>
            </Link>
          ) : (
            <span
              className="pagination-link is-disabled"
              aria-label="已是最后一页"
            >
              ›
            </span>
          )}
        </div>
      </nav>

      <Dialog
        open={Boolean(selected)}
        kicker="APPLICATION DETAIL"
        title={
          selected
            ? `${selected.companyName} · ${selected.positionName}`
            : "投递详情"
        }
        onClose={() => setSelected(null)}
      >
        <div className="detail-dialog-body">
          {selected && !detail && (
            <div className="detail-meta-grid">
              <div>
                <span>当前状态</span>
                <strong>{STATUS_LABELS[selected.status]}</strong>
              </div>
              <div>
                <span>投递日期</span>
                <strong>{selected.appliedDate}</strong>
              </div>
              <div>
                <span>工作城市</span>
                <strong>{selected.city || "未填写"}</strong>
              </div>
              <div>
                <span>最近更新</span>
                <strong>{selected.latestDate}</strong>
              </div>
            </div>
          )}
          {loading && (
            <p className="detail-loading detail-loading-inline">
              正在加载阶段和备注…
            </p>
          )}
          {error && <p className="field-error">{error}</p>}
          {detail && (
            <>
              <div className="detail-meta-grid">
                <div>
                  <span>当前状态</span>
                  <strong>{STATUS_LABELS[detail.status]}</strong>
                </div>
                <div>
                  <span>投递日期</span>
                  <strong>{detail.appliedDate}</strong>
                </div>
                <div>
                  <span>工作城市</span>
                  <strong>{detail.city || "未填写"}</strong>
                </div>
                <div>
                  <span>最近更新</span>
                  <strong>{detail.latestDate}</strong>
                </div>
              </div>
              <RecruitmentStageTimeline
                application={detail}
                onUpdate={(updated) => {
                  setDetail(updated);
                  setSelected(updated);
                }}
              />
              {detail.notes && (
                <section className="detail-section">
                  <h3>备注</h3>
                  <p className="detail-notes">{detail.notes}</p>
                </section>
              )}
              <div className="detail-dialog-actions">
                {detail.jobUrl && (
                  <a
                    className="button secondary"
                    href={detail.jobUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    打开投递链接 ↗
                  </a>
                )}
                <button
                  className="button"
                  type="button"
                  onClick={() => {
                    setSelected(null);
                    setEditing(detail);
                  }}
                >
                  编辑这条投递
                </button>
              </div>
            </>
          )}
        </div>
      </Dialog>
      <EditApplicationDialog
        application={editing}
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
      />
    </section>
  );
}
