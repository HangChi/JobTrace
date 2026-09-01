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
  preserveUrlHash?: boolean;
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

const MAINLAND_CHINA_LOCATION_PATTERN =
  /中国|china|beijing|北京|shanghai|上海|shenzhen|深圳|guangzhou|广州|hangzhou|杭州|suzhou|苏州|chengdu|成都|nanjing|南京|wuhan|武汉|tianjin|天津|chongqing|重庆|xi['’]?an|西安|wuxi|无锡|ningbo|宁波|xiamen|厦门|qingdao|青岛|changsha|长沙|zhengzhou|郑州|hefei|合肥|jinan|济南|foshan|佛山|dongguan|东莞|dalian|大连|shenyang|沈阳|kunming|昆明|nanchang|南昌|fuzhou|福州|haikou|海口|sanya|三亚|changchun|长春|harbin|哈尔滨|shijiazhuang|石家庄|taiyuan|太原|nanning|南宁|guiyang|贵阳|lanzhou|兰州|urumqi|乌鲁木齐|hohhot|呼和浩特|yinchuan|银川|xining|西宁|zhuhai|珠海|huizhou|惠州|changzhou|常州|nantong|南通|jiaxing|嘉兴|shaoxing|绍兴|wenzhou|温州|kunshan|昆山/i;
const OUTSIDE_MAINLAND_LOCATION_PATTERN =
  /hong kong|香港|macao|macau|澳门|taiwan|台湾|taipei|台北/i;

export function filterItemsBySourceCountries<T extends AdapterJobInput>(
  source: JobMarketSource,
  items: T[],
) {
  if (!source.countryCodes.map((code) => code.toLowerCase()).includes("cn"))
    return items;
  return items.filter((item) => {
    const locations = locationNames(item.locations).join(" ");
    return (
      !OUTSIDE_MAINLAND_LOCATION_PATTERN.test(locations) &&
      MAINLAND_CHINA_LOCATION_PATTERN.test(locations)
    );
  });
}

export function normalizeAdapterJob(
  source: JobMarketSource,
  value: AdapterJobInput,
): NormalizedJob {
  const title = optionalText(value.title);
  if (!title) throw new Error("missing title");
  const urlOptions = { preserveHash: value.preserveUrlHash === true };
  const detailUrl = canonicalHttpsUrl(
    optionalText(value.detailUrl, 2048),
    urlOptions,
  );
  const applyUrl = canonicalHttpsUrl(
    optionalText(value.applyUrl, 2048),
    urlOptions,
  );
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
