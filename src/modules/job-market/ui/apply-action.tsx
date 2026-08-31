"use client";
import { useState } from "react";
import { Dialog } from "@/shared/ui/dialog";
import type { CampaignDetail } from "../domain/entities";

export function ApplyAction({
  campaignId,
  mode,
  url,
  status,
  label = "立即投递",
}: {
  campaignId: string;
  mode: "single" | "select" | "unavailable";
  url: string | null;
  status: string;
  label?: string;
}) {
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  if (mode === "single" && url && status === "open")
    return (
      <a
        className="button primary button-small"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
      >
        {label}
      </a>
    );
  async function choose() {
    setOpen(true);
    if (detail) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/job-market/campaigns/${campaignId}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error();
      setDetail((await response.json()) as CampaignDetail);
    } catch {
      setError("暂时无法加载岗位投递地址");
    } finally {
      setLoading(false);
    }
  }
  if (mode === "unavailable" || status !== "open")
    return (
      <button
        className="button secondary button-small"
        disabled
        title={status !== "open" ? "招聘记录已失效" : "暂无安全的官方投递地址"}
      >
        {label}
      </button>
    );
  return (
    <>
      <button
        className="button primary button-small"
        type="button"
        onClick={choose}
      >
        {label}
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        kicker="官方入口"
        title="选择要投递的岗位"
        description="将在新页面打开来源提供的官方地址。"
      >
        <div className="job-market-choice" role="list">
          {loading && <p role="status">正在加载岗位…</p>}
          {error && <p role="alert">{error}</p>}
          {detail?.jobs
            .filter((job) => job.status === "open" && job.applyUrl)
            .map((job) => (
              <a
                role="listitem"
                key={job.id}
                href={job.applyUrl!}
                target="_blank"
                rel="noopener noreferrer"
              >
                <strong>{job.title}</strong>
                <span>
                  {job.locations.map((item) => item.name).join("、") ||
                    "地点未提供"}
                </span>
              </a>
            ))}
        </div>
      </Dialog>
    </>
  );
}
