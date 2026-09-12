import { requireAdmin } from "@/modules/identity-access";
import { z } from "zod";
import type { DiscoveryObservation } from "./source-discovery";
import { researchCompanySite } from "./company-website-research";
import {
  DEFAULT_SITE_SCAN_QUERIES,
  scanAtsBoards,
} from "./ats-site-scan";
import { createSecureSourceClient } from "../infrastructure/secure-source-client.server";
import { PostgresSourceDiscoveryRepository } from "../infrastructure/postgres-source-discovery-repository";
import { PostgresCompanyCandidateRepository } from "../infrastructure/postgres-company-candidate-repository";

export const companyResearchSchema = z.object({
  limit: z.coerce.number().int().min(1).max(10).default(5),
});

export const atsSiteScanSchema = z.object({
  queries: z
    .array(z.string().trim().min(4).max(80))
    .max(6)
    .optional(),
});

export type CompanyResearchResult = {
  researched: number;
  detected: number;
  unrecognized: number;
  failed: number;
  pendingCandidates: number;
  details: Array<{
    company: string;
    status: "detected" | "unrecognized" | "failed";
    entryUrl: string | null;
    adapter: string | null;
    confidence: string | null;
    error?: string;
  }>;
};

export async function runCompanyResearch(
  value: unknown,
): Promise<CompanyResearchResult> {
  const input = companyResearchSchema.parse(value ?? {});
  const fetcher = createSecureSourceClient();
  const repository = new PostgresSourceDiscoveryRepository();
  const targets = await repository.listResearchTargets(input.limit);

  const result: CompanyResearchResult = {
    researched: 0,
    detected: 0,
    unrecognized: 0,
    failed: 0,
    pendingCandidates: 0,
    details: [],
  };

  for (const [index, target] of targets.entries()) {
    // 搜索引擎对连续查询限流，公司之间做间隔节流。
    if (index > 0)
      await new Promise((resolve) => setTimeout(resolve, 1500 + Math.random() * 1500));
    result.researched += 1;
    let research;
    try {
      research = await researchCompanySite(target.companyName, { fetcher });
    } catch (error) {
      result.failed += 1;
      result.details.push({
        company: target.companyName,
        status: "failed",
        entryUrl: null,
        adapter: null,
        confidence: null,
        error: error instanceof Error ? error.message : "research_failed",
      });
      continue;
    }

    const best = research.best;
    if (!best) {
      result.unrecognized += 1;
      result.details.push({
        company: target.companyName,
        status: "unrecognized",
        entryUrl: null,
        adapter: null,
        confidence: null,
      });
      continue;
    }

    const observation: DiscoveryObservation = {
      target: {
        companyId: target.companyId,
        companyName: target.companyName,
        entryUrl: best.finalUrl,
      },
      detected: best.detected,
      healthStatus: best.error ? "unreachable" : "healthy",
      evidenceCode: best.detected?.evidenceCode ?? "research_engine",
      httpStatus: best.httpStatus ?? undefined,
    };
    await repository.record(observation);
    if (best.detected) {
      result.detected += 1;
      result.details.push({
        company: target.companyName,
        status: "detected",
        entryUrl: best.finalUrl,
        adapter: best.detected.adapter,
        confidence: best.detected.confidence,
      });
    } else {
      result.unrecognized += 1;
      result.details.push({
        company: target.companyName,
        status: "unrecognized",
        entryUrl: best.finalUrl,
        adapter: null,
        confidence: null,
      });
    }
  }

  const { summary } = await repository.list();
  result.pendingCandidates = summary.pendingCandidates;
  return result;
}

export async function runCompanyResearchNow(value: unknown) {
  await requireAdmin();
  return runCompanyResearch(value);
}

export type AtsSiteScanResult = {
  queries: number;
  hits: number;
  skipped: number;
  knownCompanies: number;
  existingSources: number;
  queued: number;
  pendingCandidates: number;
  details: Array<{ company: string; boardUrl: string; adapter: string }>;
};

export async function runAtsSiteScan(value: unknown): Promise<AtsSiteScanResult> {
  const input = atsSiteScanSchema.parse(value ?? {});
  const queries = input.queries ?? [...DEFAULT_SITE_SCAN_QUERIES];
  const fetcher = createSecureSourceClient();
  const scan = await scanAtsBoards(queries, { fetcher });

  const repository = new PostgresCompanyCandidateRepository();
  const { known, queued, existingSources } = await repository.enqueueSiteScan(
    scan.hits.map((hit) => ({
      companyName: hit.companyName,
      boardUrl: hit.boardUrl,
      articleTitle: hit.articleTitle,
      detected: {
        adapter: hit.detected.adapter,
        externalKey: hit.detected.externalKey,
        baseUrl: hit.detected.baseUrl,
        allowedHosts: hit.detected.allowedHosts,
        confidence: hit.detected.confidence as "high" | "medium",
      },
    })),
  );
  const { summary } = await repository.list();

  return {
    queries: queries.length,
    hits: scan.hits.length,
    skipped: scan.skipped,
    knownCompanies: known,
    existingSources,
    queued,
    pendingCandidates: summary.pending,
    details: scan.hits
      .slice(0, 10)
      .map((hit) => ({
        company: hit.companyName,
        boardUrl: hit.boardUrl,
        adapter: hit.detected.adapter,
      })),
  };
}

export async function runAtsSiteScanNow(value: unknown) {
  await requireAdmin();
  return runAtsSiteScan(value);
}
