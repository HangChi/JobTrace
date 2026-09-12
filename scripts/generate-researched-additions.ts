import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  DEFAULT_SOURCE_CATALOG,
  RETIRED_FEISHU_SOURCES,
} from "../src/modules/job-market/application/default-source-catalog";

// 已在默认目录中验证可靠的适配器：检索命中后直接成为自动同步来源。
const PROVEN_ADAPTERS = new Set([
  "moka",
  "beisen",
  "dayee",
  "workday",
  "job51",
  "xiaomi",
  "china_bigtech",
  "smartrecruiters",
  "greenhouse",
  "lever",
]);

type VerifiedUrl = {
  url: string;
  finalUrl: string;
  httpStatus: number | null;
  error?: string;
  detected: {
    adapter: string;
    externalKey: string;
    baseUrl: string;
    allowedHosts: string[];
    confidence: string;
    evidenceCode: string;
  } | null;
  kind: "high" | "medium" | "unrecognized" | "unreachable";
};

type VerifiedCompany = {
  company: string;
  companyType?: string;
  industry?: string;
  candidates?: string[];
  status?: string;
  verified: VerifiedUrl[];
  best: VerifiedUrl | null;
};

const shortHash = (value: string) =>
  createHash("sha256").update(value).digest("hex").slice(0, 10);

const verified = JSON.parse(
  await readFile("tmp/company-research/verified.json", "utf8"),
) as VerifiedCompany[];

// 冒烟实测抓不到岗位的来源（scripts/smoke-test-researched-sources.ts 产出），
// 降级为官网目录条目而不是自动同步来源。
const smokeFailures = JSON.parse(
  (await readFile("tmp/company-research/smoke-failures.json", "utf8").catch(
    () => "[]",
  )) as string,
) as Array<{ identityKey: string }>;
const failedIdentityKeys = new Set(
  smokeFailures.map((failure) => failure.identityKey),
);

const wechatCompanies = JSON.parse(
  await readFile("tmp/company-research/wechat-companies.json", "utf8"),
) as Array<{
  identityKey: string;
  companyName: string;
  companyType: string;
  industry: string;
}>;
const wechatByName = new Map(
  wechatCompanies.map((company) => [company.companyName, company]),
);

// 生成是幂等的：researched 条目经 default-source-catalog 反灌回来后必须
// 从去重基准中剔除，否则第二轮生成会把自己全部去重掉。
const baseCatalog = DEFAULT_SOURCE_CATALOG.filter(
  (entry) => !entry.identityKey.startsWith("default:researched-src-"),
);
const existingCatalogKeys = new Set(
  baseCatalog.map((entry) => `${entry.adapter}|${entry.externalKey}`),
);
const existingCatalogNames = new Set(
  baseCatalog.map((entry) => entry.companyName),
);
const retiredFeishuHosts = new Set(
  RETIRED_FEISHU_SOURCES.map((row) => row[3] as string),
);

const sourceAdditions: Array<Record<string, unknown>> = [];
const officialSiteAdditions: Array<Record<string, unknown>> = [];
const seenSourceKeys = new Set<string>();
const skipped: Array<{ company: string; reason: string }> = [];

for (const company of verified) {
  const meta = wechatByName.get(company.company);
  if (!meta) {
    skipped.push({ company: company.company, reason: "not_in_wechat_list" });
    continue;
  }
  const best = company.best;
  if (!best) {
    skipped.push({ company: company.company, reason: "no_candidates" });
    continue;
  }
  if (best.kind === "unreachable") {
    skipped.push({
      company: company.company,
      reason: `unreachable:${best.error ?? best.httpStatus}`,
    });
    continue;
  }

  const detected = best.detected;
  const companyType = company.companyType || meta.companyType;
  const industry = company.industry || meta.industry;

  const proven =
    detected &&
    best.kind === "high" &&
    PROVEN_ADAPTERS.has(detected.adapter) &&
    !failedIdentityKeys.has(
      `default:researched-src-${shortHash(company.company)}`,
    ) &&
    !existingCatalogKeys.has(`${detected.adapter}|${detected.externalKey}`) &&
    !existingCatalogNames.has(company.company) &&
    !detected.allowedHosts.some(
      (host) => host.endsWith(".jobs.feishu.cn") && retiredFeishuHosts.has(host),
    );

  if (proven && detected) {
    const duplicateKey = `${detected.adapter}|${detected.externalKey}`;
    if (!seenSourceKeys.has(duplicateKey)) {
      seenSourceKeys.add(duplicateKey);
      sourceAdditions.push({
        identityKey: `default:researched-src-${shortHash(company.company)}`,
        companyIdentityKey: meta.identityKey,
        companyName: company.company,
        companyType,
        industry,
        websiteUrl: best.finalUrl,
        adapter: detected.adapter,
        externalKey: detected.externalKey,
        baseUrl: detected.baseUrl,
        allowedHosts: detected.allowedHosts,
        countryCodes: ["cn"],
        syncIntervalMinutes: 360,
      });
      continue;
    }
    // 同一 ATS 门户已由另一主体占用：保留为官网目录条目而非第二个来源。
  }

  officialSiteAdditions.push({
    identityKey: meta.identityKey,
    companyName: company.company,
    companyType,
    industry,
    entryUrl: best.finalUrl,
  });
}

const existing = new Set<string>();
const dedupedSources = sourceAdditions.filter((entry) => {
  const key = `${entry.adapter}|${entry.externalKey}`;
  if (existing.has(key)) return false;
  existing.add(key);
  return true;
});

const directorySeen = new Set<string>();
const dedupedOfficialSites = officialSiteAdditions.filter((entry) => {
  if (directorySeen.has(String(entry.companyName))) return false;
  directorySeen.add(String(entry.companyName));
  return true;
});

await writeFile(
  "src/modules/job-market/application/researched-source-additions.json",
  `${JSON.stringify(
    dedupedSources.sort((left, right) =>
      String(left.companyName).localeCompare(String(right.companyName), "zh-CN"),
    ),
    null,
    1,
  )}\n`,
);
await writeFile(
  "src/modules/job-market/application/researched-official-sites.json",
  `${JSON.stringify(
    dedupedOfficialSites.sort((left, right) =>
      String(left.companyName).localeCompare(String(right.companyName), "zh-CN"),
    ),
    null,
    1,
  )}\n`,
);

console.log("source additions:", dedupedSources.length);
const byAdapter: Record<string, number> = {};
for (const entry of dedupedSources)
  byAdapter[String(entry.adapter)] = (byAdapter[String(entry.adapter)] ?? 0) + 1;
console.log("by adapter:", byAdapter);
console.log("official-site additions:", dedupedOfficialSites.length);
console.log("skipped:", skipped.length);
const byReason: Record<string, number> = {};
for (const item of skipped)
  byReason[item.reason.split(":")[0]] = (byReason[item.reason.split(":")[0]] ?? 0) + 1;
console.log("skip reasons:", byReason);
