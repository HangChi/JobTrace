import { requireAdmin } from "@/modules/identity-access";
import { z } from "zod";
import type { DiscoveryObservation } from "./source-discovery";
import { researchCompanySite } from "./company-website-research";
import { createSecureSourceClient } from "../infrastructure/secure-source-client.server";
import { PostgresSourceDiscoveryRepository } from "../infrastructure/postgres-source-discovery-repository";

export const companyResearchSchema = z.object({
  limit: z.coerce.number().int().min(1).max(10).default(5),
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
