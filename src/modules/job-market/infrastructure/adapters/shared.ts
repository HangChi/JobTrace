import { createHash } from "node:crypto";
import type { SecureSourceFetch } from "../../application/ports";
import type {
  JobMarketSource,
  NormalizedJob,
  RejectedSourceItem,
} from "../../domain/entities";
import {
  campaignKey,
  canonicalHttpsUrl,
  contentHash,
  normalizeText,
  plainText,
  safeDate,
  uniqueLocations,
} from "../../domain/normalization";

export type AdapterJobInput = {
  id?: unknown;
  title?: unknown;
  locations?: unknown;
  campaign?: unknown;
  batch?: unknown;
  recruitmentType?: unknown;
  target?: unknown;
  education?: unknown;
  description?: unknown;
  detailUrl?: unknown;
  applyUrl?: unknown;
  publishedAt?: unknown;
  validThrough?: unknown;
  closed?: unknown;
};

function optionalText(value: unknown, max = 300) {
  return typeof value === "string" && value.trim()
    ? value.normalize("NFKC").trim().slice(0, max)
    : null;
}

function locationNames(value: unknown): string[] {
  if (typeof value === "string") return value.split(/[;；、]/).filter(Boolean);
  if (Array.isArray(value))
    return value.flatMap((item) =>
      typeof item === "string"
        ? [item]
        : item && typeof item === "object" && "name" in item
          ? [String(item.name)]
          : [],
    );
  if (value && typeof value === "object" && "name" in value)
    return [String(value.name)];
  return [];
}

export function normalizeAdapterJob(
  source: JobMarketSource,
  value: AdapterJobInput,
): NormalizedJob {
  const title = optionalText(value.title);
  if (!title) throw new Error("missing title");
  const detailUrl = canonicalHttpsUrl(optionalText(value.detailUrl, 2048));
  const applyUrl = canonicalHttpsUrl(optionalText(value.applyUrl, 2048));
  const explicitId = optionalText(value.id, 500);
  const externalJobId =
    explicitId ??
    createHash("sha256")
      .update([title, detailUrl, applyUrl].join("|"))
      .digest("hex");
  const campaignName = optionalText(value.campaign);
  const recruitmentType = optionalText(value.recruitmentType, 100);
  const normalized: Omit<NormalizedJob, "contentHash"> = {
    externalJobId,
    title,
    normalizedTitle: normalizeText(title),
    locations: uniqueLocations(locationNames(value.locations)),
    campaignName,
    campaignKey: campaignKey({
      explicit: campaignName,
      sourceKey: source.externalKey,
      recruitmentType,
    }),
    batchLabel: optionalText(value.batch, 200),
    recruitmentType,
    target: optionalText(value.target),
    education: optionalText(value.education, 200),
    descriptionText: plainText(optionalText(value.description, 50_000)),
    detailUrl,
    applyUrl,
    publishedAt: safeDate(value.publishedAt),
    validThrough: safeDate(value.validThrough),
    sourceStatus: value.closed === true ? "closed" : "open",
  };
  return { ...normalized, contentHash: contentHash(normalized) };
}

export function normalizeItems(
  source: JobMarketSource,
  items: AdapterJobInput[],
) {
  const jobs: NormalizedJob[] = [];
  const rejected: RejectedSourceItem[] = [];
  for (const item of items) {
    try {
      jobs.push(normalizeAdapterJob(source, item));
    } catch {
      rejected.push({
        externalJobId: optionalText(item.id, 500) ?? undefined,
        reasonCode: "invalid_item",
        safeSummary: "Source item is missing required fields",
      });
    }
  }
  return { jobs, rejected };
}

export async function fetchJson(
  fetcher: SecureSourceFetch,
  source: JobMarketSource,
  url: string,
  signal: AbortSignal,
) {
  return fetcher(url, {
    allowedHosts: source.allowedHosts,
    signal,
    accept: ["application/json", "application/ld+json"],
    headers: Object.fromEntries(
      [
        source.etag ? ["If-None-Match", source.etag] : null,
        source.lastModified ? ["If-Modified-Since", source.lastModified] : null,
      ].filter((item): item is [string, string] => Boolean(item)),
    ),
  });
}
