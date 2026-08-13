"use client";

import Link from "next/link";
import { useState } from "react";
import { Dialog } from "@/shared/ui/dialog";
import type {
  ApplicationDetail,
  ApplicationPage,
  ApplicationSummary,
} from "../application/contracts";
import { STAGE_LABELS, STATUS_LABELS } from "../domain/catalog";

function latestStage(item: ApplicationSummary) {
  return item.stages.at(-1);
}

export function ApplicationTable({ page }: { page: ApplicationPage }) {
  const [selected, setSelected] = useState<ApplicationSummary | null>(null);
  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

  return (
    <section
      className="panel application-list-panel"
      aria-labelledby="application-list-title"
    >
      <div className="section-heading">
        <div>
          <p className="section-kicker">APPLICATIONS</p>
          <h2 id="application-list-title">投递记录</h2>
        </div>
        <span className="record-count">本页 {page.items.length} 条</span>
      </div>
      <div className="table-wrap">
        <table>
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
                    if (!(event.target as HTMLElement).closest("a, button")) {
                      void openDetail(item);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      void openDetail(item);
                    }
                  }}
                >
                  <td data-label="公司与岗位">
                    <strong>{item.companyName}</strong>
                    <span className="table-subline">{item.positionName}</span>
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
                        打开职位 <span aria-hidden="true">↗</span>
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
                    <span className={`status-badge status-${item.status}`}>
                      {STATUS_LABELS[item.status]}
                    </span>
                    {item.needsFollowUp && (
                      <span className="follow-up">
                        {item.followUpDays} 天未更新
                      </span>
                    )}
                  </td>
                  <td data-label="投递日期">{item.appliedDate}</td>
                  <td data-label="操作">
                    <Link
                      className="edit-link"
                      href={`/applications/${item.id}`}
                    >
                      编辑 <span aria-hidden="true">✎</span>
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {page.nextCursor && (
        <p className="more-records">还有更多记录，请缩小筛选范围查看。</p>
      )}

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
          {loading && <p className="detail-loading">正在加载投递详情…</p>}
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
              <section className="detail-section">
                <h3>招聘阶段</h3>
                {detail.stageOccurrences.length ? (
                  <ol className="detail-stage-list">
                    {detail.stageOccurrences.map((stage) => (
                      <li key={stage.id} className={`stage-${stage.stage}`}>
                        <i aria-hidden="true" />
                        <span>{STAGE_LABELS[stage.stage]}</span>
                        <time>{stage.occurredOn}</time>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="muted">还没有记录招聘阶段。</p>
                )}
              </section>
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
                <Link className="button" href={`/applications/${detail.id}`}>
                  编辑这条投递
                </Link>
              </div>
            </>
          )}
        </div>
      </Dialog>
    </section>
  );
}
