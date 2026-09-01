"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SourceCandidate } from "../../infrastructure/postgres-source-discovery-repository";

type Summary = {
  directoryCompanies: number;
  automaticCompanies: number;
  scannableCompanies: number;
  reviewedCompanies: number;
  pendingCandidates: number;
};

const REVIEW_LABELS: Record<SourceCandidate["reviewStatus"], string> = {
  unrecognized: "未识别",
  pending: "待审核",
  approved: "已批准",
  ignored: "已忽略",
};

const HEALTH_LABELS: Record<SourceCandidate["healthStatus"], string> = {
  healthy: "可访问",
  unreachable: "访问失败",
  unsupported: "不支持",
};

export function SourceDiscoveryPanel({
  candidates,
  summary,
}: {
  candidates: SourceCandidate[];
  summary: Summary;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function scan() {
    setBusy("scan");
    setMessage("正在安全检查招聘入口…");
    try {
      const response = await fetch("/api/admin/job-market/discovery", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ limit: 10 }),
      });
      const body = (await response.json()) as {
        scanned?: number;
        recognized?: number;
        message?: string;
      };
      if (!response.ok) throw new Error(body.message || "扫描失败");
      setMessage(
        `已检查 ${body.scanned ?? 0} 家，识别到 ${body.recognized ?? 0} 个待审核来源。`,
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "扫描失败");
    } finally {
      setBusy(null);
    }
  }

  async function review(id: string, action: "approve" | "ignore") {
    setBusy(id);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/job-market/discovery/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const body = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(body.message || "审核失败");
      setMessage(
        action === "approve" ? "候选已批准并加入自动同步。" : "候选已忽略。",
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "审核失败");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="panel stack source-discovery-panel">
      <div className="source-discovery-heading">
        <div>
          <p className="eyebrow">来源发现</p>
          <h2>招聘入口扫描与审核</h2>
          <p className="muted">
            只识别公开 ATS 或 JobPosting
            数据。扫描结果不会自动启用，必须由管理员批准。
          </p>
        </div>
        <button className="button" disabled={busy !== null} onClick={scan}>
          {busy === "scan" ? "正在扫描…" : "扫描下一批"}
        </button>
      </div>

      <dl className="source-discovery-stats">
        <div>
          <dt>自动来源</dt>
          <dd>{summary.automaticCompanies}</dd>
        </div>
        <div>
          <dt>企业目录</dt>
          <dd>{summary.directoryCompanies}</dd>
        </div>
        <div>
          <dt>可扫描官网</dt>
          <dd>{summary.scannableCompanies}</dd>
        </div>
        <div>
          <dt>待审核</dt>
          <dd>{summary.pendingCandidates}</dd>
        </div>
      </dl>

      <p className="source-discovery-message" role="status" aria-live="polite">
        {message || `已检查 ${summary.reviewedCompanies} 家目录企业`}
      </p>

      {candidates.length ? (
        <div className="table-wrap">
          <table className="source-discovery-table">
            <thead>
              <tr>
                <th>企业 / 入口</th>
                <th>识别结果</th>
                <th>健康状态</th>
                <th>审核状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((candidate) => (
                <tr key={candidate.id}>
                  <td>
                    <strong>{candidate.companyName}</strong>
                    <a
                      href={candidate.entryUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      查看招聘入口
                    </a>
                  </td>
                  <td>
                    {candidate.adapter ? (
                      <>
                        <strong>{candidate.adapter}</strong>
                        <span>
                          {candidate.confidence === "high"
                            ? "高置信度"
                            : "需核对结构化数据"}
                        </span>
                      </>
                    ) : (
                      <span>暂未识别受支持的数据源</span>
                    )}
                  </td>
                  <td>
                    <span
                      className={`source-discovery-badge is-${candidate.healthStatus}`}
                    >
                      {HEALTH_LABELS[candidate.healthStatus]}
                    </span>
                    <small>{candidate.diagnosticSummary || "检查正常"}</small>
                  </td>
                  <td>
                    <span
                      className={`source-discovery-badge is-${candidate.reviewStatus}`}
                    >
                      {REVIEW_LABELS[candidate.reviewStatus]}
                    </span>
                    <small>
                      {new Date(candidate.lastCheckedAt).toLocaleString(
                        "zh-CN",
                      )}
                    </small>
                  </td>
                  <td>
                    {candidate.reviewStatus === "pending" ? (
                      <div className="actions">
                        <button
                          className="button button-small"
                          disabled={busy === candidate.id}
                          onClick={() => review(candidate.id, "approve")}
                        >
                          批准并启用
                        </button>
                        <button
                          className="button secondary button-small"
                          disabled={busy === candidate.id}
                          onClick={() => review(candidate.id, "ignore")}
                        >
                          忽略
                        </button>
                      </div>
                    ) : candidate.reviewStatus === "unrecognized" ? (
                      <button
                        className="button secondary button-small"
                        disabled={busy === candidate.id}
                        onClick={() => review(candidate.id, "ignore")}
                      >
                        标记已查看
                      </button>
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
          <strong>还没有扫描记录</strong>
          <span>点击“扫描下一批”检查目录中的公开招聘官网。</span>
        </div>
      )}
    </section>
  );
}
