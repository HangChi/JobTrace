"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type {
  DefaultCatalogItem,
  DefaultCatalogPage,
  DefaultCatalogSummary,
} from "../../application/contracts";

type BootstrapResult = {
  companyCount: number;
  sourceCount?: number;
  createdCompanies: number;
  createdSources: number;
  directoryCount?: number;
  createdDirectoryEntries?: number;
  sync: {
    accepted: number;
    succeeded: number;
    partial: number;
    failed: number;
    skipped: number;
  };
};

export function DefaultSourceBootstrap({
  summary,
  scheduledSyncEnabled,
}: {
  summary: DefaultCatalogSummary;
  scheduledSyncEnabled: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [catalogPage, setCatalogPage] = useState<DefaultCatalogPage | null>(
    null,
  );
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");

  async function loadCatalog(page: number) {
    setCatalogLoading(true);
    setCatalogError("");
    try {
      const response = await fetch(
        `/api/admin/job-market/catalog?page=${page}&limit=50`,
      );
      const body = (await response.json()) as DefaultCatalogPage & {
        message?: string;
      };
      if (!response.ok) throw new Error(body.message || "目录加载失败");
      setCatalogPage(body);
    } catch (error) {
      setCatalogError(error instanceof Error ? error.message : "目录加载失败");
    } finally {
      setCatalogLoading(false);
    }
  }

  function toggleDirectory() {
    const nextOpen = !directoryOpen;
    setDirectoryOpen(nextOpen);
    if (nextOpen && !catalogPage && !catalogLoading) void loadCatalog(1);
  }

  async function initialize() {
    setBusy(true);
    setMessage("正在登记默认企业并同步公开岗位，首次运行可能需要 1–2 分钟…");
    try {
      const response = await fetch("/api/admin/job-market/bootstrap", {
        method: "POST",
      });
      const body = (await response.json()) as BootstrapResult & {
        message?: string;
      };
      if (!response.ok) throw new Error(body.message || "初始化失败");
      setMessage(
        `已处理 ${body.companyCount} 家企业（自动来源 ${body.sourceCount ?? body.createdSources} 个、公众号目录 ${body.directoryCount ?? 0} 个）；首次同步成功 ${body.sync.succeeded} 个、部分成功 ${body.sync.partial} 个、失败 ${body.sync.failed} 个。`,
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "初始化失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel stack default-source-bootstrap admin-sync-setup-card">
      <div className="default-source-bootstrap-heading">
        <div>
          <p className="eyebrow">快速配置</p>
          <h2>默认企业目录</h2>
        </div>
        <span
          className={`admin-setup-status ${scheduledSyncEnabled ? "is-enabled" : "is-disabled"}`}
        >
          {scheduledSyncEnabled ? "定时同步已开启" : "定时同步未开启"}
        </span>
      </div>
      <p className="muted admin-setup-description">
        一次登记预置企业与公开招聘入口；可安全重复执行，不会创建重复数据。
      </p>
      <dl className="default-source-summary">
        <div>
          <dt>企业总数</dt>
          <dd>{summary.total}</dd>
        </div>
        <div>
          <dt>自动同步</dt>
          <dd>{summary.automatic}</dd>
        </div>
        <div>
          <dt>官网 / 公众号</dt>
          <dd>{summary.directory}</dd>
        </div>
      </dl>
      <div className="default-source-action-row">
        <button className="button" disabled={busy} onClick={initialize}>
          {busy ? "正在初始化并同步…" : "一键初始化并首次同步"}
        </button>
        <span>首次运行约需 1–2 分钟</span>
      </div>
      <div className="default-source-directory">
        <button
          className="admin-disclosure-button"
          type="button"
          aria-expanded={directoryOpen}
          onClick={toggleDirectory}
        >
          {directoryOpen ? "收起预置目录" : "查看预置目录"}
          <span aria-hidden="true">⌄</span>
        </button>
        {directoryOpen && (
          <div className="default-source-directory-content">
            <p className="muted">
              自动来源会同步岗位；目录来源只提供官网或公众号招聘原文，不抓取封闭内容。
            </p>
            {catalogLoading && <p role="status">正在加载目录…</p>}
            {catalogError && <p role="alert">{catalogError}</p>}
            {catalogPage && (
              <CatalogPage
                value={catalogPage}
                disabled={catalogLoading}
                onPageChange={(page) => void loadCatalog(page)}
              />
            )}
          </div>
        )}
      </div>
      {!scheduledSyncEnabled && (
        <aside className="admin-schedule-notice" aria-label="定时同步配置提示">
          <span className="admin-schedule-notice-mark" aria-hidden="true" />
          <div>
            <strong>持续定时同步尚未启用</strong>
            <p>
              如需持续更新岗位，请启用 <code>JOB_MARKET_ENABLED=true</code>
              ，并配置同步密钥和外部调度任务。
            </p>
          </div>
        </aside>
      )}
      {message && (
        <p className="admin-sync-message" role="status" aria-live="polite">
          {message}
        </p>
      )}
    </section>
  );
}

function CatalogPage({
  value,
  disabled,
  onPageChange,
}: {
  value: DefaultCatalogPage;
  disabled: boolean;
  onPageChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(value.total / value.limit));
  return (
    <>
      <ul className="default-source-catalog" aria-label="默认企业来源">
        {value.items.map((item: DefaultCatalogItem) => (
          <li key={item.identityKey ?? item.companyName}>
            <a href={item.websiteUrl} target="_blank" rel="noreferrer noopener">
              {item.companyName}
            </a>
            <span>{item.industry}</span>
            <small>{item.channelLabel ?? item.adapter}</small>
          </li>
        ))}
      </ul>
      <nav className="pagination-actions" aria-label="默认企业目录分页">
        <button
          type="button"
          disabled={disabled || value.page <= 1}
          onClick={() => onPageChange(value.page - 1)}
        >
          上一页
        </button>
        <span>
          第 {value.page} / {pages} 页，共 {value.total} 家
        </span>
        <button
          type="button"
          disabled={disabled || value.page >= pages}
          onClick={() => onPageChange(value.page + 1)}
        >
          下一页
        </button>
      </nav>
    </>
  );
}
