"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type SourceHealth = {
  id: string;
  company: { name: string };
  adapter: string;
  baseUrl?: string;
  status: "active" | "paused" | "revoked";
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  consecutiveFailures?: number;
  latestRun: {
    status?: "running" | "succeeded" | "partial" | "failed";
    counts: {
      discovered: number;
      created: number;
      updated: number;
      closed: number;
    };
    errorSummary: string | null;
  } | null;
};

const STATUS_LABELS: Record<SourceHealth["status"], string> = {
  active: "运行中",
  paused: "已暂停",
  revoked: "已撤销",
};

type RunStatus = NonNullable<SourceHealth["latestRun"]>["status"];

const RUN_LABELS: Record<Exclude<RunStatus, undefined>, string> = {
  running: "同步中",
  succeeded: "成功",
  partial: "部分成功",
  failed: "失败",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SourceHealthTable({ sources }: { sources: SourceHealth[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  async function action(
    id: string,
    kind: "sync" | "active" | "paused" | "revoked",
  ) {
    setBusy(id);
    setMessage("");
    try {
      const response = await fetch(
        kind === "sync"
          ? `/api/admin/job-market/sources/${id}/sync`
          : `/api/admin/job-market/sources/${id}`,
        kind === "sync"
          ? { method: "POST" }
          : {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ status: kind }),
            },
      );
      if (!response.ok) throw new Error((await response.json()).message);
      setMessage(kind === "sync" ? "已触发同步" : "来源状态已更新");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失败");
    } finally {
      setBusy(null);
    }
  }
  const activeCount = sources.filter(
    (source) => source.status === "active",
  ).length;
  const failedCount = sources.filter(
    (source) => source.latestRun?.status === "failed",
  ).length;
  return (
    <section className="panel stack admin-sync-panel source-health-panel">
      <div className="source-health-heading">
        <div>
          <p className="eyebrow">02 · 运行监控</p>
          <h2>自动同步来源</h2>
          <p className="muted">查看最近运行结果，快速重试或调整来源状态。</p>
        </div>
        <div className="source-health-totals" aria-label="来源状态汇总">
          <span>
            <strong>{sources.length}</strong> 全部
          </span>
          <span>
            <strong>{activeCount}</strong> 运行中
          </span>
          <span className={failedCount ? "is-danger" : undefined}>
            <strong>{failedCount}</strong> 失败
          </span>
        </div>
      </div>
      <p className="source-health-message" role="status" aria-live="polite">
        {message}
      </p>
      {sources.length ? (
        <div className="table-wrap source-health-table-wrap">
          <table className="source-health-table">
            <thead>
              <tr>
                <th>企业与来源</th>
                <th>状态</th>
                <th>最近运行</th>
                <th>岗位变化</th>
                <th>诊断</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((source) => (
                <tr key={source.id}>
                  <td>
                    <strong className="source-company-name">
                      {source.company.name}
                    </strong>
                    {source.baseUrl ? (
                      <a
                        href={source.baseUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        {source.adapter}
                      </a>
                    ) : (
                      <span className="source-adapter-label">
                        {source.adapter}
                      </span>
                    )}
                  </td>
                  <td>
                    <span className={`source-state-badge is-${source.status}`}>
                      {STATUS_LABELS[source.status]}
                    </span>
                    {(source.consecutiveFailures ?? 0) > 0 && (
                      <small>{source.consecutiveFailures} 次连续失败</small>
                    )}
                  </td>
                  <td>
                    {source.latestRun?.status ? (
                      <span
                        className={`source-run-state is-${source.latestRun.status}`}
                      >
                        {RUN_LABELS[source.latestRun.status]}
                      </span>
                    ) : source.latestRun ? (
                      <span className="source-run-state is-succeeded">
                        已完成
                      </span>
                    ) : (
                      <span className="muted">暂无运行</span>
                    )}
                    <small>尝试 {formatDate(source.lastAttemptAt)}</small>
                    <small>成功 {formatDate(source.lastSuccessAt)}</small>
                  </td>
                  <td>
                    {source.latestRun ? (
                      <span className="source-run-counts">
                        {`发现 ${source.latestRun.counts.discovered} / 新增 ${source.latestRun.counts.created} / 更新 ${source.latestRun.counts.updated} / 失效 ${source.latestRun.counts.closed}`}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td
                    className={`source-diagnostic${
                      source.latestRun?.errorSummary ? " is-error" : ""
                    }`}
                  >
                    {source.latestRun?.errorSummary || "运行正常"}
                  </td>
                  <td>
                    <div className="actions">
                      <button
                        className="button secondary button-small"
                        disabled={
                          busy === source.id || source.status !== "active"
                        }
                        onClick={() => action(source.id, "sync")}
                      >
                        重试
                      </button>
                      {source.status === "active" ? (
                        <button
                          className="button secondary button-small"
                          disabled={busy === source.id}
                          onClick={() => action(source.id, "paused")}
                        >
                          暂停
                        </button>
                      ) : source.status !== "revoked" ? (
                        <button
                          className="button secondary button-small"
                          disabled={busy === source.id}
                          onClick={() => action(source.id, "active")}
                        >
                          启用
                        </button>
                      ) : null}
                      <button
                        className="button danger button-small"
                        disabled={
                          busy === source.id || source.status === "revoked"
                        }
                        onClick={() => action(source.id, "revoked")}
                      >
                        撤销
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="source-discovery-empty">
          <strong>还没有自动同步来源</strong>
          <span>可从默认目录初始化，或手动登记一个合规来源。</span>
        </div>
      )}
    </section>
  );
}
