"use client";

import Link from "next/link";
import type { Route } from "next";
import { useState } from "react";
import { DismissibleDetails } from "@/shared/ui/dismissible-details";
import { EditIcon } from "@/shared/ui/action-icons";
import { DeleteApplicationDialog } from "./delete-application-dialog";
import { EditApplicationDialog } from "./application-dialogs";
import { ApplicationStatusSelect } from "./application-status-select";
import { ApplicationDetailDialog } from "./application-detail-dialog";
import type {
  ApplicationDetail,
  ApplicationPage,
  ApplicationSummary,
} from "../application/contracts";
import { STAGE_LABELS, TYPE_LABELS } from "../domain/catalog";
import { formatCompanyWithCity } from "../application/display";

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
  onMutation,
}: {
  page: ApplicationPage;
  query?: Search;
  onMutation?: () => void;
}) {
  const [overrides, setOverrides] = useState<
    Record<string, ApplicationSummary>
  >({});
  const [selected, setSelected] = useState<ApplicationSummary | null>(null);
  const [editing, setEditing] = useState<ApplicationDetail | null>(null);

  const items = page.items.map((item) => {
    const override = overrides[item.id];
    return override && override.version >= item.version ? override : item;
  });

  function replaceItem(detail: ApplicationSummary) {
    const summary: ApplicationSummary = {
      id: detail.id,
      companyName: detail.companyName,
      positionName: detail.positionName,
      city: detail.city,
      jobUrl: detail.jobUrl,
      appliedDate: detail.appliedDate,
      type: detail.type,
      status: detail.status,
      latestDate: detail.latestDate,
      stages: detail.stages,
      needsFollowUp: detail.needsFollowUp,
      followUpDays: detail.followUpDays,
      followUpReason: detail.followUpReason,
      version: detail.version,
    };
    setOverrides((current) => ({ ...current, [summary.id]: summary }));
    setSelected((current) => (current?.id === summary.id ? summary : current));
    onMutation?.();
  }
  const pageSize =
    typeof query.limit === "string" &&
    PAGE_SIZES.includes(query.limit as (typeof PAGE_SIZES)[number])
      ? query.limit
      : "10";
  const pageNumber = page.page;
  const totalPages = Math.max(1, Math.ceil(page.total / page.limit));

  async function openEditor(item: ApplicationSummary) {
    try {
      const response = await fetch(`/api/applications/${item.id}`);
      if (!response.ok) throw new Error("暂时无法加载投递信息");
      setEditing(await response.json());
    } catch {
      setSelected(item);
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
            <col className="type-column" />
            <col className="stage-column" />
            <col className="status-column" />
            <col className="date-column" />
            <col className="actions-column" />
          </colgroup>
          <thead>
            <tr>
              <th>公司与岗位</th>
              <th>投递链接</th>
              <th>类型</th>
              <th>阶段</th>
              <th>状态</th>
              <th>投递日期</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const stage = latestStage(item);
              const applicationType = item.type ?? "campus_recruitment";
              const companyDisplayName = formatCompanyWithCity(
                item.companyName,
                item.city,
              );
              return (
                <tr
                  key={item.id}
                  className="application-row"
                  tabIndex={0}
                  aria-label={`查看 ${companyDisplayName} ${item.positionName} 详情`}
                  onClick={(event) => {
                    if (
                      !(event.target as HTMLElement).closest(
                        "a, button, select, input",
                      )
                    ) {
                      setSelected(item);
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
                      setSelected(item);
                    }
                  }}
                >
                  <td className="application-name-cell" data-label="公司与岗位">
                    <strong title={companyDisplayName}>
                      {companyDisplayName}
                    </strong>
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
                        aria-label={`打开 ${companyDisplayName} 的投递链接`}
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
                  <td data-label="类型">
                    <span className={`type-badge type-${applicationType}`}>
                      {TYPE_LABELS[applicationType]}
                    </span>
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
                    <ApplicationStatusSelect
                      key={`${item.id}-${item.version}`}
                      application={item}
                      onUpdate={replaceItem}
                    />
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
                        <EditIcon />
                        <span>编辑</span>
                      </button>
                      <DeleteApplicationDialog
                        compact
                        id={item.id}
                        name={`${companyDisplayName} · ${item.positionName}`}
                        onDeleted={onMutation}
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

      <ApplicationDetailDialog
        application={selected}
        onClose={() => setSelected(null)}
        onUpdate={replaceItem}
      />
      <EditApplicationDialog
        application={editing}
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        onSuccess={replaceItem}
      />
    </section>
  );
}
