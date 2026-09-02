import type {
  CampaignDetail,
  CampaignSummary,
  JobMarketSource,
  NormalizedSourceBatch,
  SyncStatus,
  SyncTrigger,
} from "../domain/entities";

export type SourceFetchResponse = {
  status: number;
  headers: Headers;
  text(): Promise<string>;
  json(): Promise<unknown>;
};

export type SecureSourceFetch = (
  url: string,
  options: {
    allowedHosts: string[];
    signal: AbortSignal;
    headers?: Record<string, string>;
    accept: readonly string[];
    method?: "GET" | "POST";
    body?: string;
  },
) => Promise<SourceFetchResponse>;

export interface SourceAdapter {
  readonly kind: JobMarketSource["adapter"];
  fetch(
    source: JobMarketSource,
    context: { runId: string; now: Date; maxItems: number },
    signal: AbortSignal,
  ): Promise<NormalizedSourceBatch>;
}

export type CampaignQuery = {
  campaignId?: string;
  q?: string;
  company?: string;
  location?: string;
  status?: "open" | "stale" | "closed";
  postedFrom?: string;
  favorite?: boolean;
  page: number;
  limit: number;
};

export interface CampaignRepository {
  list(
    ownerId: string,
    query: CampaignQuery,
  ): Promise<{
    items: CampaignSummary[];
    page: number;
    limit: number;
    total: number;
  }>;
  get(ownerId: string, campaignId: string): Promise<CampaignDetail | null>;
  setFavorite(
    ownerId: string,
    campaignId: string,
    favorite: boolean,
  ): Promise<boolean>;
}

export interface SyncRepository {
  claimDue(
    limit: number,
    workerId: string,
    now: Date,
  ): Promise<JobMarketSource[]>;
  claimOne(
    sourceId: string,
    workerId: string,
    now: Date,
  ): Promise<JobMarketSource | null>;
  beginRun(
    sourceId: string,
    trigger: SyncTrigger,
    workerId: string,
    requestId: string,
  ): Promise<string>;
  completeRun(
    runId: string,
    status: Exclude<SyncStatus, "running">,
    result: SyncResult,
  ): Promise<void>;
  markSourceSuccess(
    sourceId: string,
    now: Date,
    intervalMinutes: number,
    metadata: { etag?: string; lastModified?: string },
  ): Promise<void>;
  markSourceFailure(sourceId: string, now: Date, retryAt: Date): Promise<void>;
}

export type SyncResult = {
  discovered: number;
  created: number;
  updated: number;
  stale: number;
  closed: number;
  rejected: number;
  errorCode?: string;
  errorSummary?: string;
};

export interface JobMarketRepository {
  applyBatch(
    source: JobMarketSource,
    runId: string,
    batch: NormalizedSourceBatch,
    now: Date,
  ): Promise<SyncResult>;
}
