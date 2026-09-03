"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type CatalogItem = {
  identityKey?: string;
  companyName: string;
  adapter?: string;
  industry: string;
  websiteUrl: string;
  channel?: "automatic" | "official_site" | "wechat";
  channelLabel?: string;
};

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
  catalog,
  scheduledSyncEnabled,
}: {
  catalog: CatalogItem[];
  scheduledSyncEnabled: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const automaticCount = catalog.filter(
    (item) => item.channel === "automatic",
  ).length;
  const directoryCount = catalog.length - automaticCount;

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
          <dd>{catalog.length}</dd>
        </div>
        <div>
          <dt>自动同步</dt>
          <dd>{automaticCount}</dd>
        </div>
        <div>
          <dt>官网 / 公众号</dt>
          <dd>{directoryCount}</dd>
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
          onClick={() => setDirectoryOpen((open) => !open)}
        >
          {directoryOpen ? "收起预置目录" : "查看预置目录"}
          <span aria-hidden="true">⌄</span>
        </button>
        {directoryOpen && (
          <div className="default-source-directory-content">
            <p className="muted">
              自动来源会同步岗位；目录来源只提供官网或公众号招聘原文，不抓取封闭内容。
            </p>
            <ul className="default-source-catalog" aria-label="默认企业来源">
              {catalog.map((item) => (
                <li key={item.identityKey ?? item.companyName}>
                  <a
                    href={item.websiteUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    {item.companyName}
                  </a>
                  <span>{item.industry}</span>
                  <small>{item.channelLabel ?? item.adapter}</small>
                </li>
              ))}
            </ul>
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
