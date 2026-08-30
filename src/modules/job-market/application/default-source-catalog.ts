import type { SourceAdapterKind } from "../domain/entities";

export type DefaultSourceCatalogEntry = {
  identityKey: string;
  companyName: string;
  companyType: string;
  industry: string;
  websiteUrl: string;
  adapter: SourceAdapterKind;
  externalKey: string;
  baseUrl: string;
  allowedHosts: string[];
  syncIntervalMinutes: number;
};

/**
 * Curated public ATS boards verified on 2026-08-30. Keep this list deliberately
 * small so a first-run bootstrap completes promptly; new sources still require
 * an explicit code review because they expand the outbound allowlist.
 */
export const DEFAULT_SOURCE_CATALOG = [
  {
    identityKey: "default:sourcegraph",
    companyName: "Sourcegraph",
    companyType: "科技企业",
    industry: "开发者工具 / 人工智能",
    websiteUrl: "https://sourcegraph.com/",
    adapter: "greenhouse",
    externalKey: "sourcegraph91",
    baseUrl: "https://boards-api.greenhouse.io/",
    allowedHosts: ["boards-api.greenhouse.io"],
    syncIntervalMinutes: 360,
  },
  {
    identityKey: "default:linear",
    companyName: "Linear",
    companyType: "科技企业",
    industry: "协作软件",
    websiteUrl: "https://linear.app/",
    adapter: "ashby",
    externalKey: "linear",
    baseUrl: "https://api.ashbyhq.com/",
    allowedHosts: ["api.ashbyhq.com"],
    syncIntervalMinutes: 360,
  },
  {
    identityKey: "default:discord",
    companyName: "Discord",
    companyType: "科技企业",
    industry: "互联网 / 社交通信",
    websiteUrl: "https://discord.com/",
    adapter: "greenhouse",
    externalKey: "discord",
    baseUrl: "https://boards-api.greenhouse.io/",
    allowedHosts: ["boards-api.greenhouse.io"],
    syncIntervalMinutes: 360,
  },
  {
    identityKey: "default:postman",
    companyName: "Postman",
    companyType: "科技企业",
    industry: "开发者工具",
    websiteUrl: "https://www.postman.com/",
    adapter: "greenhouse",
    externalKey: "postman",
    baseUrl: "https://boards-api.greenhouse.io/",
    allowedHosts: ["boards-api.greenhouse.io"],
    syncIntervalMinutes: 360,
  },
  {
    identityKey: "default:tailscale",
    companyName: "Tailscale",
    companyType: "科技企业",
    industry: "网络安全 / 云计算",
    websiteUrl: "https://tailscale.com/",
    adapter: "greenhouse",
    externalKey: "tailscale",
    baseUrl: "https://boards-api.greenhouse.io/",
    allowedHosts: ["boards-api.greenhouse.io"],
    syncIntervalMinutes: 360,
  },
  {
    identityKey: "default:vercel",
    companyName: "Vercel",
    companyType: "科技企业",
    industry: "云计算 / 开发者平台",
    websiteUrl: "https://vercel.com/",
    adapter: "greenhouse",
    externalKey: "vercel",
    baseUrl: "https://boards-api.greenhouse.io/",
    allowedHosts: ["boards-api.greenhouse.io"],
    syncIntervalMinutes: 360,
  },
  {
    identityKey: "default:perplexity",
    companyName: "Perplexity",
    companyType: "科技企业",
    industry: "人工智能",
    websiteUrl: "https://www.perplexity.ai/",
    adapter: "ashby",
    externalKey: "perplexity",
    baseUrl: "https://api.ashbyhq.com/",
    allowedHosts: ["api.ashbyhq.com"],
    syncIntervalMinutes: 360,
  },
  {
    identityKey: "default:cursor",
    companyName: "Cursor",
    companyType: "科技企业",
    industry: "人工智能 / 开发者工具",
    websiteUrl: "https://www.cursor.com/",
    adapter: "ashby",
    externalKey: "cursor",
    baseUrl: "https://api.ashbyhq.com/",
    allowedHosts: ["api.ashbyhq.com"],
    syncIntervalMinutes: 360,
  },
] as const satisfies readonly DefaultSourceCatalogEntry[];

export function publicDefaultSourceCatalog() {
  return DEFAULT_SOURCE_CATALOG.map(
    ({ companyName, adapter, industry, websiteUrl }) => ({
      companyName,
      adapter,
      industry,
      websiteUrl,
    }),
  );
}
