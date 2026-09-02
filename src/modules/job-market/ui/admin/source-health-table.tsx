"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
export function SourceHealthTable({ sources }: { sources: Array<any> }) {
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
  return (
    <section className="panel stack">
      <div>
        <h2>招聘来源</h2>
        <p className="muted" role="status">
          {message || `共 ${sources.length} 个来源`}
        </p>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>企业 / 类型</th>
              <th>状态</th>
              <th>最近尝试 / 成功</th>
              <th>变化</th>
              <th>诊断</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => (
              <tr key={source.id}>
                <td>
                  <strong>{source.company.name}</strong>
                  <br />
                  <span>{source.adapter}</span>
                </td>
                <td>{source.status}</td>
                <td>
                  {source.lastAttemptAt
                    ? new Date(source.lastAttemptAt).toLocaleString("zh-CN")
                    : "无"}
                  <br />
                  {source.lastSuccessAt
                    ? new Date(source.lastSuccessAt).toLocaleString("zh-CN")
                    : "尚未成功"}
                </td>
                <td>
                  {source.latestRun
                    ? `发现 ${source.latestRun.counts.discovered} / 新增 ${source.latestRun.counts.created} / 更新 ${source.latestRun.counts.updated} / 失效 ${source.latestRun.counts.closed}`
                    : "无运行"}
                </td>
                <td>{source.latestRun?.errorSummary || "—"}</td>
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
                        onClick={() => action(source.id, "paused")}
                      >
                        暂停
                      </button>
                    ) : source.status !== "revoked" ? (
                      <button
                        className="button secondary button-small"
                        onClick={() => action(source.id, "active")}
                      >
                        启用
                      </button>
                    ) : null}
                    <button
                      className="button danger button-small"
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
    </section>
  );
}
