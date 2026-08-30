import { createHash } from "node:crypto";
import type { NormalizedJob } from "./entities";
import { canonicalHttpsUrl, normalizeText } from "./normalization";

export type DedupCandidate = {
  postId: string;
  companyId: string;
  sourceId: string;
  externalJobId: string;
  isOfficial: boolean;
  job: NormalizedJob;
};

export function jobFingerprint(companyId: string, job: NormalizedJob) {
  const locations = job.locations
    .map((item) => item.normalizedKey)
    .sort()
    .join("|");
  return createHash("sha256")
    .update(
      [companyId, job.campaignKey, normalizeText(job.title), locations].join(
        "\n",
      ),
    )
    .digest("hex");
}

export function findDedupMatch(
  incoming: {
    companyId: string;
    sourceId: string;
    isOfficial: boolean;
    job: NormalizedJob;
  },
  candidates: DedupCandidate[],
) {
  const exact = candidates.find(
    (candidate) =>
      candidate.sourceId === incoming.sourceId &&
      candidate.externalJobId === incoming.job.externalJobId,
  );
  if (exact) return { candidate: exact, reason: "source_identity" as const };
  const incomingUrls = new Set(
    [incoming.job.detailUrl, incoming.job.applyUrl]
      .map(canonicalHttpsUrl)
      .filter((value): value is string => Boolean(value)),
  );
  const url = candidates.find(
    (candidate) =>
      candidate.companyId === incoming.companyId &&
      [candidate.job.detailUrl, candidate.job.applyUrl]
        .map(canonicalHttpsUrl)
        .some((value) => value && incomingUrls.has(value)),
  );
  if (url) return { candidate: url, reason: "canonical_url" as const };
  const fingerprint = jobFingerprint(incoming.companyId, incoming.job);
  const exactFingerprint = candidates.filter(
    (candidate) =>
      candidate.companyId === incoming.companyId &&
      jobFingerprint(candidate.companyId, candidate.job) === fingerprint,
  );
  if (exactFingerprint.length === 1)
    return {
      candidate: exactFingerprint[0],
      reason: "exact_fingerprint" as const,
    };
  return null;
}

export function choosePrimary<
  T extends { isOfficial: boolean; lastSeenAt: Date },
>(values: T[]) {
  return (
    [...values].sort(
      (a, b) =>
        Number(b.isOfficial) - Number(a.isOfficial) ||
        b.lastSeenAt.getTime() - a.lastSeenAt.getTime(),
    )[0] ?? null
  );
}
