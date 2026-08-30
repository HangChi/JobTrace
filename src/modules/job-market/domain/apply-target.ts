import type { CampaignJob, PostStatus } from "./entities";
import { canonicalHttpsUrl } from "./normalization";

export function applyTargetForJobs(
  jobs: Pick<CampaignJob, "id" | "title" | "status" | "applyUrl">[],
  campaignUrl?: string | null,
) {
  const safeCampaignUrl = canonicalHttpsUrl(campaignUrl);
  if (safeCampaignUrl)
    return {
      mode: "single" as const,
      primaryApplyUrl: safeCampaignUrl,
      jobs: [],
    };
  const valid = jobs
    .filter((job) => job.status === "open")
    .map((job) => ({ ...job, applyUrl: canonicalHttpsUrl(job.applyUrl) }))
    .filter((job): job is typeof job & { applyUrl: string } =>
      Boolean(job.applyUrl),
    );
  if (valid.length === 1)
    return {
      mode: "single" as const,
      primaryApplyUrl: valid[0].applyUrl,
      jobs: valid,
    };
  if (valid.length > 1)
    return { mode: "select" as const, primaryApplyUrl: null, jobs: valid };
  return { mode: "unavailable" as const, primaryApplyUrl: null, jobs: [] };
}

export function applyUnavailableReason(status: PostStatus, url: string | null) {
  if (status !== "open") return "该岗位已失效";
  if (!canonicalHttpsUrl(url)) return "来源未提供安全的官方投递地址";
  return null;
}
