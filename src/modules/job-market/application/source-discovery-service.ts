import { requireAdmin } from "@/modules/identity-access";
import { Problem } from "@/shared/errors/problem";
import {
  sourceCandidateIdSchema,
  sourceCandidateReviewSchema,
  sourceDiscoveryScanSchema,
} from "./contracts";
import { scanDiscoveryTargets } from "./source-discovery";
import { createSecureSourceClient } from "../infrastructure/secure-source-client.server";
import {
  PostgresSourceDiscoveryRepository,
  type SourceCandidate,
} from "../infrastructure/postgres-source-discovery-repository";

export async function scanSourceCandidates(value: unknown) {
  await requireAdmin();
  const input = sourceDiscoveryScanSchema.parse(value);
  return scanDiscoveryTargets(input.limit, {
    repository: new PostgresSourceDiscoveryRepository(),
    fetcher: createSecureSourceClient(),
  });
}

export async function listSourceCandidates(status?: string) {
  await requireAdmin();
  const allowed = ["unrecognized", "pending", "approved", "ignored"];
  if (status && !allowed.includes(status))
    throw new Problem("validation", "候选状态无效。", 400);
  return new PostgresSourceDiscoveryRepository().list(
    status as SourceCandidate["reviewStatus"] | undefined,
  );
}

export async function reviewSourceCandidate(id: string, value: unknown) {
  await requireAdmin();
  const candidateId = sourceCandidateIdSchema.parse(id);
  const input = sourceCandidateReviewSchema.parse(value);
  const repository = new PostgresSourceDiscoveryRepository();
  if (input.action === "ignore") {
    if (!(await repository.ignore(candidateId)))
      throw new Problem("not_found", "没有找到可忽略的候选来源。", 404);
    return { id: candidateId, reviewStatus: "ignored" as const };
  }
  const result = await repository.approve(candidateId);
  if (result.outcome === "not_found")
    throw new Problem("not_found", "没有找到候选来源。", 404);
  if (result.outcome === "not_approvable")
    throw new Problem(
      "candidate_not_approvable",
      "只有健康且已识别的待审核候选才能批准。",
      409,
    );
  if (result.outcome === "conflict")
    throw new Problem("conflict", "该招聘来源已存在或无法创建。", 409);
  return {
    id: candidateId,
    reviewStatus: "approved" as const,
    sourceId: result.sourceId,
  };
}
