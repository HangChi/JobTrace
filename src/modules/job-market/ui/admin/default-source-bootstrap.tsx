"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type CatalogItem = {
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
    <section className="panel stack default-source-bootstrap">
      <div className="default-source-bootstrap-heading">
        <div>
          <h2>默认企业来源目录</h2>
          <p className="muted">
            当前包含 {catalog.length}{" "}
            家国内企业及外企中国招聘入口。自动来源会同步岗位；目录来源提供官网或公众号招聘原文，不抓取封闭内容。初始化是幂等的。
          </p>
        </div>
        <button className="button" disabled={busy} onClick={initialize}>
          {busy ? "正在初始化并同步…" : "一键初始化并首次同步"}
        </button>
      </div>
      <ul className="default-source-catalog" aria-label="默认企业来源">
        {catalog.map((item) => (
          <li key={item.companyName}>
            <a href={item.websiteUrl} target="_blank" rel="noreferrer noopener">
              {item.companyName}
            </a>
            <span>{item.industry}</span>
            <small>{item.channelLabel ?? item.adapter}</small>
          </li>
        ))}
      </ul>
      {!scheduledSyncEnabled && (
        <p className="notice warning">
          首次同步可由此按钮直接执行；持续定时同步尚未启用，请配置
          <code> JOB_MARKET_ENABLED=true </code>
          、同步密钥和外部调度任务后重启服务。
        </p>
      )}
      <p role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}
