import { createServerDatabase } from "@/shared/database";
import { getJobMarketEnv } from "@/shared/config/env";
import type { JobMarketSource } from "../domain/entities";
import type { SourceAdapter } from "./ports";
import {
  createAdapterRegistry,
  synchronizeOneSource,
} from "./synchronize-due-sources";
import { createSecureSourceClient } from "../infrastructure/secure-source-client.server";
import { PostgresSourceDiscoveryRepository } from "../infrastructure/postgres-source-discovery-repository";
import { PostgresCompanyCandidateRepository } from "../infrastructure/postgres-company-candidate-repository";
import { isAutoApprovable } from "./auto-approval-policy";
import type { AdminJobReporter } from "./admin-jobs";

async function syncImmediately(sourceId: string) {
  try {
    const result = await synchronizeOneSource(sourceId);
    return result.status === "succeeded" || result.status === "partial";
  } catch {
    // 岗位已可由 6 小时定时器补同步；缓存失效等非致命错误不阻塞转正。
    return false;
  }
}

async function smokeFetch(
  adapter: SourceAdapter,
  fields: {
    adapter: string;
    externalKey: string;
    baseUrl: string;
    allowedHosts: string[];
  },
): Promise<boolean> {
  const source: JobMarketSource = {
    id: "auto-approve-smoke",
    companyId: "smoke",
    companyName: "smoke",
    adapter: fields.adapter as JobMarketSource["adapter"],
    externalKey: fields.externalKey,
    baseUrl: fields.baseUrl,
    allowedHosts: fields.allowedHosts,
    countryCodes: ["cn"],
    isOfficial: true,
    accessBasis: "public",
    status: "active",
    syncIntervalMinutes: 360,
    consecutiveFailures: 0,
    etag: null,
    lastModified: null,
  };
  try {
    const batch = await adapter.fetch(
      source,
      { runId: "auto-approve-smoke", now: new Date(), maxItems: 50 },
      AbortSignal.timeout(30000),
    );
    return batch.jobs.length > 0;
  } catch {
    return false;
  }
}

export type AutoApprovalReport = {
  enabled: boolean;
  approvedCompanies: number;
  approvedSources: number;
  synced: number;
  skipped: number;
  details: Array<{ company: string; note: string }>;
};

export async function autoApproveHighConfidence(
  onProgress?: AdminJobReporter,
): Promise<AutoApprovalReport> {
  const report: AutoApprovalReport = {
    enabled: getJobMarketEnv().autoApprove,
    approvedCompanies: 0,
    approvedSources: 0,
    synced: 0,
    skipped: 0,
    details: [],
  };
  if (!report.enabled) return report;

  const fetcher = createSecureSourceClient();
  const adapters = createAdapterRegistry(fetcher);
  const discovery = new PostgresSourceDiscoveryRepository();
  const companies = new PostgresCompanyCandidateRepository();
  const sql = createServerDatabase();

  // 1) site_scan 公司候选：冒烟 → 收录 → 来源候选 → 批准来源 → 立即同步。
  const companyCandidates = await sql<
    Array<{
      id: string;
      companyName: string;
      detectedAdapter: string | null;
      detectedConfidence: string | null;
      detectedExternalKey: string | null;
      detectedBaseUrl: string | null;
      detectedAllowedHosts: string[];
    }>
  >`
    select id,company_name as "companyName",detected_adapter::text as "detectedAdapter",
      detected_confidence::text as "detectedConfidence",detected_external_key as "detectedExternalKey",
      detected_base_url as "detectedBaseUrl",detected_allowed_hosts as "detectedAllowedHosts"
    from job_market_company_candidates
    where review_status='pending' and source_engine='site_scan'
    order by created_at limit 10`;
  for (const [index, candidate] of companyCandidates.entries()) {
    onProgress?.({
      phase: "自动转正公司候选",
      current: index + 1,
      total: companyCandidates.length,
      message: candidate.companyName,
    });
    if (
      !isAutoApprovable({
        adapter: candidate.detectedAdapter,
        confidence: candidate.detectedConfidence,
        sourceEngine: "site_scan",
      }) ||
      !candidate.detectedExternalKey ||
      !candidate.detectedBaseUrl
    ) {
      report.skipped += 1;
      continue;
    }
    const adapter = adapters.get(
      candidate.detectedAdapter as JobMarketSource["adapter"],
    );
    if (!adapter) {
      report.skipped += 1;
      continue;
    }
    const smoked = await smokeFetch(adapter, {
      adapter: candidate.detectedAdapter!,
      externalKey: candidate.detectedExternalKey,
      baseUrl: candidate.detectedBaseUrl,
      allowedHosts: candidate.detectedAllowedHosts,
    });
    if (!smoked) {
      report.skipped += 1;
      report.details.push({
        company: candidate.companyName,
        note: "smoke_failed_kept_pending",
      });
      continue;
    }
    const approval = await companies.approve(candidate.id);
    if (approval.outcome !== "approved") {
      report.skipped += 1;
      continue;
    }
    report.approvedCompanies += 1;
    // approve() 已生成 pending 来源候选：接着自动批准并立即同步。
    const [sourceCandidate] = await sql<Array<{ id: string }>>`
      select id from job_market_source_candidates
      where company_id=${approval.companyId} and review_status='pending'
        and evidence_code='ats_site_scan' order by created_at desc limit 1`;
    if (!sourceCandidate) continue;
    const sourceApproval = await discovery.approve(sourceCandidate.id);
    if (sourceApproval.outcome === "approved" && sourceApproval.sourceId) {
      report.approvedSources += 1;
      if (await syncImmediately(sourceApproval.sourceId)) report.synced += 1;
    }
    report.details.push({
      company: candidate.companyName,
      note: "auto_approved",
    });
  }

  // 2) 已有公司的 ats_site_scan 来源候选：冒烟 → 批准 → 立即同步。
  const sourceCandidates = await sql<
    Array<{
      id: string;
      companyName: string;
      adapter: string | null;
      confidence: string | null;
      externalKey: string | null;
      baseUrl: string | null;
      allowedHosts: string[];
    }>
  >`
    select candidate.id,company.canonical_name as "companyName",candidate.adapter::text as "adapter",
      candidate.confidence::text as "confidence",candidate.external_key as "externalKey",
      candidate.base_url as "baseUrl",candidate.allowed_hosts as "allowedHosts"
    from job_market_source_candidates candidate
    join job_market_companies company on company.id=candidate.company_id
    where candidate.review_status='pending' and candidate.evidence_code='ats_site_scan'
      and candidate.confidence='high'
    order by candidate.created_at limit 10`;
  for (const [index, candidate] of sourceCandidates.entries()) {
    onProgress?.({
      phase: "自动转正来源候选",
      current: index + 1,
      total: sourceCandidates.length,
      message: candidate.companyName,
    });
    if (
      !isAutoApprovable({
        adapter: candidate.adapter,
        confidence: candidate.confidence,
        evidenceCode: "ats_site_scan",
      }) ||
      !candidate.externalKey ||
      !candidate.baseUrl
    ) {
      report.skipped += 1;
      continue;
    }
    const adapter = adapters.get(
      candidate.adapter as JobMarketSource["adapter"],
    );
    if (!adapter) {
      report.skipped += 1;
      continue;
    }
    const smoked = await smokeFetch(adapter, {
      adapter: candidate.adapter!,
      externalKey: candidate.externalKey,
      baseUrl: candidate.baseUrl,
      allowedHosts: candidate.allowedHosts,
    });
    if (!smoked) {
      report.skipped += 1;
      report.details.push({
        company: candidate.companyName,
        note: "smoke_failed_kept_pending",
      });
      continue;
    }
    const approval = await discovery.approve(candidate.id);
    if (approval.outcome === "approved" && approval.sourceId) {
      report.approvedSources += 1;
      if (await syncImmediately(approval.sourceId)) report.synced += 1;
      report.details.push({
        company: candidate.companyName,
        note: "auto_approved",
      });
    }
  }
  return report;
}
