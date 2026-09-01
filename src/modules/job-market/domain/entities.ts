export const SOURCE_ADAPTERS = [
  "greenhouse",
  "lever",
  "ashby",
  "smartrecruiters",
  "moka",
  "schema_org",
  "xiaomi",
  "feishu",
] as const;
export type SourceAdapterKind = (typeof SOURCE_ADAPTERS)[number];
export type SourceStatus = "active" | "paused" | "revoked";
export type PostStatus = "open" | "stale" | "closed";
export type SyncStatus = "running" | "succeeded" | "partial" | "failed";
export type SyncTrigger = "scheduled" | "admin";

export type JobMarketCompany = {
  id: string;
  canonicalName: string;
  normalizedName: string;
  companyType: string | null;
  industry: string | null;
  websiteUrl: string | null;
};

export type JobMarketSource = {
  id: string;
  companyId: string;
  companyName: string;
  adapter: SourceAdapterKind;
  externalKey: string;
  baseUrl: string;
  allowedHosts: string[];
  countryCodes: string[];
  isOfficial: boolean;
  accessBasis: "public" | "authorized";
  status: SourceStatus;
  syncIntervalMinutes: number;
  consecutiveFailures: number;
  etag: string | null;
  lastModified: string | null;
};

export type NormalizedLocation = {
  name: string;
  normalizedKey: string;
  isRemote: boolean;
};

export type NormalizedJob = {
  externalJobId: string;
  title: string;
  normalizedTitle: string;
  locations: NormalizedLocation[];
  campaignName: string | null;
  campaignKey: string;
  batchLabel: string | null;
  recruitmentType: string | null;
  target: string | null;
  education: string | null;
  descriptionText: string | null;
  detailUrl: string | null;
  applyUrl: string | null;
  publishedAt: Date | null;
  validThrough: Date | null;
  sourceStatus: "open" | "closed" | "unknown";
  contentHash: string;
};

export type RejectedSourceItem = {
  externalJobId?: string;
  reasonCode: string;
  safeSummary: string;
};

export type NormalizedSourceBatch = {
  completeness: "complete" | "partial";
  sourceMetadata: {
    fetchedAt: Date;
    etag?: string;
    lastModified?: string;
  };
  jobs: NormalizedJob[];
  rejected: RejectedSourceItem[];
};

export type CampaignLocation = { name: string; isRemote: boolean };
export type CampaignJob = {
  id: string;
  title: string;
  locations: CampaignLocation[];
  status: PostStatus;
  applyUrl: string | null;
  applyUnavailableReason: string | null;
  publishedAt: string | null;
  validThrough: string | null;
  sourceName: string;
  sourceUrl: string;
  alreadyTrackedApplicationId: string | null;
};

export type CampaignSummary = {
  id: string;
  listingKind: "synced_jobs" | "recruitment_directory";
  company: {
    id: string;
    name: string;
    type: string | null;
    industry: string | null;
  };
  campaignName: string | null;
  recruitmentType: string | null;
  batchLabel: string | null;
  positions: string[];
  positionCount: number;
  locations: CampaignLocation[];
  status: PostStatus;
  applyMode: "single" | "select" | "unavailable";
  primaryApplyUrl: string | null;
  source: { name: string; url: string };
  publishedAt: string | null;
  validThrough: string | null;
  lastConfirmedAt: string | null;
  isFavorite: boolean;
};

export type CampaignDetail = CampaignSummary & { jobs: CampaignJob[] };
