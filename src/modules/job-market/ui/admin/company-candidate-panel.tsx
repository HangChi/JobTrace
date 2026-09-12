"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CompanyCandidate } from "../../application/contracts";
import { useAdminJob } from "./use-admin-job";

type Summary = {
  pending: number;
  approved: number;
  ignored: number;
};

const REVIEW_LABELS: Record<CompanyCandidate["reviewStatus"], string> = {
  pending: "待审核",
  approved: "已收录",
  ignored: "已忽略",
};

const ENGINE_LABELS: Record<CompanyCandidate["sourceEngine"], string> = {
  sogou: "搜狗",
  bing: "必应",
  site_scan: "ATS 枚举",
};

export function CompanyCandidatePanel({
  candidates,
  summary,
}: {
  candidates: CompanyCandidate[];
  summary: Summary;
}) {
  const job = useAdminJob();
  const router = useRouter();
  const [action, setAction] = useState<"collect" | "scan" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  function collectNow() {
    setAction("collect");
    void job.start({
      url: "/api/admin/job-market/company-candidates",
      runningMessage: "正在后台从搜索引擎采集微信招聘文章…",
      summarize: (result) => {
        const body = result as {
          extracted?: number;
          queued?: number;
          candidates?: number;
          engines?: Array<{ engine: string; status: string }>;
        };
        const engineSummary =
          body.engines
            ?.map((engine) => `${engine.engine}:${engine.status}`)
            .join(" ") ?? "";
        return `提取 ${body.extracted ?? 0} 家，新入队 ${body.queued ?? 0} 家，当前待审核 ${body.candidates ?? 0} 家（${engineSummary}）。`;
      },
    });
  }

  function scanNow() {
    setAction("scan");
    void job.start({
      url: "/api/admin/job-market/ats-site-scan",
      runningMessage: "正在后台用 site: 查询枚举 ATS 招聘板…",
      summarize: (result) => {
        const body = result as {
          hits?: number;
          queued?: number;
          knownCompanies?: number;
          pendingCandidates?: number;
        };
        return (
          `命中 ${body.hits ?? 0} 个招聘板，新入队 ${body.queued ?? 0} 家、` +
          `已知公司 ${body.knownCompanies ?? 0} 家，当前待审核 ${body.pendingCandidates ?? 0} 家。`
        );
      },
    });
  }

  async function review(
    candidate: CompanyCandidate,
    action: "approve" | "ignore",
  ) {
    setBusy(candidate.id);
    setMessage("");
    try {
      const response = await fetch(
        `/api/admin/job-market/company-candidates/${candidate.id}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      const body = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(body.message || "审核失败");
      setMessage(
        action === "approve"
          ? `${candidate.companyName} 已收录进公众号目录。`
          : `${candidate.companyName} 已忽略。`,
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "审核失败");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="panel stack source-discovery-panel admin-sync-panel">
      <div className="source-discovery-heading">
        <div>
          <p className="eyebrow">02 · 新公司情报</p>
          <h2>公众号招聘采集</h2>
          <p className="muted">
            定时采集公开搜索引擎中的微信招聘文章；批准后公司进入公众号目录，
            再由入口扫描识别其官网与来源。
          </p>
        </div>
        <div className="source-discovery-actions">
          <button
            className="button"
            disabled={busy !== null || job.busy}
            onClick={collectNow}
          >
            {job.busy && action === "collect" ? "正在采集…" : "立即采集一批"}
          </button>
          <button
            className="button secondary"
            disabled={busy !== null || job.busy}
            onClick={scanNow}
          >
            {job.busy && action === "scan" ? "正在枚举…" : "扫描 ATS 招聘板"}
          </button>
        </div>
      </div>

      <dl className="source-discovery-stats">
        <div>
          <dt>待审核</dt>
          <dd>{summary.pending}</dd>
        </div>
        <div>
          <dt>已收录</dt>
          <dd>{summary.approved}</dd>
        </div>
        <div>
          <dt>已忽略</dt>
          <dd>{summary.ignored}</dd>
        </div>
      </dl>

      <p className="source-discovery-message" role="status" aria-live="polite">
        {job.progressText ||
          message ||
          job.message ||
          `候选来自公众号文章标题的规则提取，批准前请核对公司名与文章归属。`}
      </p>

      {candidates.length ? (
        <div className="table-wrap">
          <table className="source-discovery-table">
            <thead>
              <tr>
                <th>公司 / 文章</th>
                <th>来源</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((candidate) => (
                <tr key={candidate.id}>
                  <td>
                    <strong>{candidate.companyName}</strong>
                    <a
                      href={candidate.articleUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      {candidate.articleTitle.slice(0, 40)}
                      {candidate.articleTitle.length > 40 ? "…" : ""}
                    </a>
                    {candidate.articleCount > 1 ? (
                      <small>近期 {candidate.articleCount} 篇相关文章</small>
                    ) : null}
                  </td>
                  <td>
                    <span>{ENGINE_LABELS[candidate.sourceEngine]}</span>
                    <small>
                      {candidate.publishedAt
                        ? new Date(candidate.publishedAt).toLocaleDateString(
                            "zh-CN",
                          )
                        : new Date(candidate.createdAt).toLocaleDateString(
                            "zh-CN",
                          )}
                    </small>
                  </td>
                  <td>
                    <span
                      className={`source-discovery-badge is-${candidate.reviewStatus}`}
                    >
                      {REVIEW_LABELS[candidate.reviewStatus]}
                    </span>
                  </td>
                  <td>
                    {candidate.reviewStatus === "pending" ? (
                      <div className="actions">
                        <button
                          className="button button-small"
                          disabled={busy === candidate.id}
                          onClick={() => review(candidate, "approve")}
                        >
                          收录进目录
                        </button>
                        <button
                          className="button secondary button-small"
                          disabled={busy === candidate.id}
                          onClick={() => review(candidate, "ignore")}
                        >
                          忽略
                        </button>
                      </div>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="source-discovery-empty">
          <strong>暂无新公司候选</strong>
          <span>
            定时任务会调用内部采集接口（POST
            /api/internal/job-market/collect-wechat）， 也可手动触发一次采集。
          </span>
        </div>
      )}
    </section>
  );
}
