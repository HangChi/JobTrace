"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Dialog } from "@/shared/ui/dialog";
import type { CampaignDetail } from "../domain/entities";

export function TrackApplicationDialog({
  campaignId,
  status,
}: {
  campaignId: string;
  status: string;
}) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [error, setError] = useState("");
  async function show() {
    setOpen(true);
    if (detail) return;
    try {
      const response = await fetch(`/api/job-market/campaigns/${campaignId}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error();
      setDetail((await response.json()) as CampaignDetail);
    } catch {
      setError("暂时无法加载岗位");
    }
  }
  return (
    <>
      <button
        type="button"
        className="button secondary button-small"
        disabled={status === "closed"}
        onClick={show}
      >
        记录投递
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        kicker="我的投递"
        title="选择要记录的岗位"
        description="确认岗位后可补充投递日期和初始状态。"
      >
        <div className="job-market-choice">
          {error && <p role="alert">{error}</p>}
          {!detail && !error && <p role="status">正在加载岗位…</p>}
          {detail?.jobs.map((job) =>
            job.alreadyTrackedApplicationId ? (
              <Link
                key={job.id}
                href={
                  `/applications/${job.alreadyTrackedApplicationId}` as Route
                }
              >
                <strong>{job.title}</strong>
                <span>已记录，查看现有投递</span>
              </Link>
            ) : (
              <Link
                key={job.id}
                href={`/applications/new?jobMarketPostId=${job.id}` as Route}
              >
                <strong>{job.title}</strong>
                <span>
                  {job.locations.map((item) => item.name).join("、") ||
                    "地点未提供"}
                </span>
              </Link>
            ),
          )}
        </div>
      </Dialog>
    </>
  );
}
