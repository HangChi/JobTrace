import type { SourceAdapterKind } from "../domain/entities";
import defaultCatalogData from "./default-source-catalog.json";

// 默认来源目录数据由 scripts/generate-default-catalog.ts 生成
// （pnpm catalog:generate，CI 用 catalog:check 校验新鲜度）。
// 本文件只保留类型与派生视图；修改数据请编辑生成脚本后重新生成 JSON。

export type DefaultSourceCatalogEntry = {
  identityKey: string;
  companyIdentityKey?: string;
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

export const DEFAULT_SOURCE_CATALOG =
  defaultCatalogData.sources as readonly DefaultSourceCatalogEntry[];

// 飞书退役行的第 5 个元素是可选的入口 path。
type RetiredFeishuRow =
  | readonly [string, string, string, string]
  | readonly [string, string, string, string, string];

export const RETIRED_FEISHU_SOURCES =
  defaultCatalogData.retired as unknown as ReadonlyArray<RetiredFeishuRow>;

const CHANNEL_HINTS = defaultCatalogData.channelHints as Record<string, string>;

function channelHint(externalKey: string) {
  const channel = externalKey.split("|")[1];
  return channel ? (CHANNEL_HINTS[channel] ?? null) : null;
}

export function publicDefaultSourceCatalog() {
  return DEFAULT_SOURCE_CATALOG.map(
    ({
      identityKey,
      companyName,
      adapter,
      industry,
      websiteUrl,
      externalKey,
    }) => ({
      identityKey,
      companyName,
      adapter,
      industry,
      websiteUrl,
      channelHint: channelHint(externalKey),
    }),
  );
}
