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
  countryCodes: string[];
  syncIntervalMinutes: number;
};

/**
 * Curated public ATS boards verified on 2026-08-30. Keep this list deliberately
 * small so a first-run bootstrap completes promptly; new sources still require
 * an explicit code review because they expand the outbound allowlist.
 */
export const DEFAULT_SOURCE_CATALOG = [
  {
    identityKey: "default:xiaomi-cn",
    companyName: "小米集团",
    companyType: "民营企业",
    industry: "消费电子 / 汽车 / 人工智能",
    websiteUrl: "https://hr.xiaomi.com/",
    adapter: "xiaomi",
    externalKey: "domestic",
    baseUrl: "https://hr.xiaomi.com/website/",
    allowedHosts: ["hr.xiaomi.com"],
    countryCodes: ["cn"],
    syncIntervalMinutes: 360,
  },
  {
    identityKey: "default:bosch-cn",
    companyName: "博世中国",
    companyType: "外企",
    industry: "汽车技术 / 工业技术",
    websiteUrl: "https://www.bosch.com.cn/",
    adapter: "smartrecruiters",
    externalKey: "BoschGroup",
    baseUrl: "https://api.smartrecruiters.com/",
    allowedHosts: ["api.smartrecruiters.com"],
    countryCodes: ["cn"],
    syncIntervalMinutes: 360,
  },
  {
    identityKey: "default:avery-dennison-cn",
    companyName: "艾利丹尼森中国",
    companyType: "外企",
    industry: "材料科学 / 制造业",
    websiteUrl: "https://www.averydennison.cn/",
    adapter: "smartrecruiters",
    externalKey: "AveryDennison",
    baseUrl: "https://api.smartrecruiters.com/",
    allowedHosts: ["api.smartrecruiters.com"],
    countryCodes: ["cn"],
    syncIntervalMinutes: 360,
  },
  {
    identityKey: "default:continental-cn",
    companyName: "大陆集团中国",
    companyType: "外企",
    industry: "汽车科技 / 智能出行",
    websiteUrl: "https://www.continental.com/zh-cn/",
    adapter: "smartrecruiters",
    externalKey: "Continental",
    baseUrl: "https://api.smartrecruiters.com/",
    allowedHosts: ["api.smartrecruiters.com"],
    countryCodes: ["cn"],
    syncIntervalMinutes: 360,
  },
  {
    identityKey: "default:western-digital-cn",
    companyName: "西部数据中国",
    companyType: "外企",
    industry: "半导体 / 数据存储",
    websiteUrl: "https://www.westerndigital.com/zh-cn/",
    adapter: "smartrecruiters",
    externalKey: "WesternDigital",
    baseUrl: "https://api.smartrecruiters.com/",
    allowedHosts: ["api.smartrecruiters.com"],
    countryCodes: ["cn"],
    syncIntervalMinutes: 360,
  },
  {
    identityKey: "default:ubisoft-cn",
    companyName: "育碧中国",
    companyType: "外企",
    industry: "游戏 / 数字娱乐",
    websiteUrl: "https://www.ubisoft.com/zh-cn/company/careers",
    adapter: "smartrecruiters",
    externalKey: "Ubisoft2",
    baseUrl: "https://api.smartrecruiters.com/",
    allowedHosts: ["api.smartrecruiters.com"],
    countryCodes: ["cn"],
    syncIntervalMinutes: 360,
  },
  {
    identityKey: "default:nielseniq-cn",
    companyName: "尼尔森IQ中国",
    companyType: "外企",
    industry: "数据分析 / 市场研究",
    websiteUrl: "https://nielseniq.com/global/zh/",
    adapter: "smartrecruiters",
    externalKey: "NielsenIQ",
    baseUrl: "https://api.smartrecruiters.com/",
    allowedHosts: ["api.smartrecruiters.com"],
    countryCodes: ["cn"],
    syncIntervalMinutes: 360,
  },
  {
    identityKey: "default:qima-cn",
    companyName: "启迈QIMA中国",
    companyType: "外企",
    industry: "质量检测 / 供应链服务",
    websiteUrl: "https://www.qima.com/zh-cn/",
    adapter: "smartrecruiters",
    externalKey: "QIMA",
    baseUrl: "https://api.smartrecruiters.com/",
    allowedHosts: ["api.smartrecruiters.com"],
    countryCodes: ["cn"],
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
