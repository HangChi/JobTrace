import { requireAdmin } from "@/modules/identity-access";
import { Problem } from "@/shared/errors/problem";
import {
  companyCandidateIdSchema,
  companyCandidateReviewSchema,
  wechatCollectSchema,
  type CompanyCandidateList,
  type WechatCollectionResult,
} from "./contracts";
import {
  DEFAULT_COLLECT_QUERIES,
  collectWechatArticles,
  extractCompanyFromTitle,
} from "./wechat-article-collector";
import { createSecureSourceClient } from "../infrastructure/secure-source-client.server";
import { PostgresCompanyCandidateRepository } from "../infrastructure/postgres-company-candidate-repository";
import { normalizeText } from "../domain/normalization";

export async function runWechatCollection(value: unknown): Promise<WechatCollectionResult> {
  const input = wechatCollectSchema.parse(value ?? {});
  const queries = input.queries ?? [...DEFAULT_COLLECT_QUERIES];
  const { hits, engines } = await collectWechatArticles(queries, {
    fetcher: createSecureSourceClient(),
  });

  const extracted = hits
    .map((hit) => ({
      hit,
      companyName: extractCompanyFromTitle(hit.title),
    }))
    .filter(
      (item): item is { hit: (typeof hits)[number]; companyName: string } =>
        item.companyName !== null,
    );

  // 同批多篇文章可能命中同一家公司：按规范化名去重，保留发布最新的一篇，
  // 否则批量 upsert 会两次触及同一唯一键。
  const byCompany = new Map<string, { hit: (typeof hits)[number]; companyName: string }>();
  for (const item of extracted) {
    const normalized = normalizeText(item.companyName);
    const existing = byCompany.get(normalized);
    if (
      !existing ||
      (item.hit.publishedAt && (!existing.hit.publishedAt || item.hit.publishedAt > existing.hit.publishedAt))
    )
      byCompany.set(normalized, item);
  }
  const deduped = [...byCompany.values()];

  const repository = new PostgresCompanyCandidateRepository();
  const { known, queued } = await repository.enqueue(
    deduped.map(({ hit, companyName }) => ({
      companyName,
      articleUrl: hit.url,
      articleTitle: hit.title,
      snippet: hit.snippet,
      publishedAt: hit.publishedAt,
      sourceEngine: hit.engine,
    })),
  );
  const { summary } = await repository.list();

  return {
    engines,
    extracted: extracted.length,
    knownCompanies: known,
    queued,
    candidates: summary.pending,
  };
}

export async function collectCompanyCandidatesNow(value: unknown) {
  await requireAdmin();
  return runWechatCollection(value);
}

export async function listCompanyCandidates(
  status?: string,
): Promise<CompanyCandidateList> {
  await requireAdmin();
  const allowed = ["pending", "approved", "ignored"];
  if (status && !allowed.includes(status))
    throw new Problem("validation", "候选状态无效。", 400);
  return new PostgresCompanyCandidateRepository().list(
    status as CompanyCandidateList["items"][number]["reviewStatus"] | undefined,
  );
}

export async function reviewCompanyCandidate(id: string, value: unknown) {
  await requireAdmin();
  const candidateId = companyCandidateIdSchema.parse(id);
  const input = companyCandidateReviewSchema.parse(value);
  const repository = new PostgresCompanyCandidateRepository();
  if (input.action === "ignore") {
    if (!(await repository.ignore(candidateId)))
      throw new Problem("not_found", "没有找到可忽略的公司候选。", 404);
    return { id: candidateId, reviewStatus: "ignored" as const };
  }
  const result = await repository.approve(candidateId, {
    companyName: input.companyName,
    companyType: input.companyType,
    industry: input.industry,
  });
  if (result.outcome === "not_found")
    throw new Problem("not_found", "没有找到公司候选。", 404);
  if (result.outcome === "not_pending")
    throw new Problem("conflict", "只有待审核的公司候选才能批准。", 409);
  return {
    id: candidateId,
    reviewStatus: "approved" as const,
    companyId: result.companyId,
  };
}
