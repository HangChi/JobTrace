import defaultDirectoryData from "./default-company-directory.json";

// 公司目录数据由 scripts/generate-default-directory.ts 生成
// （pnpm company-directory:generate，CI 用 company-directory:check 校验新鲜度；
// 输入包括默认来源目录与公众号文章数据，变更后需重新生成）。
// 本文件只保留类型与派生视图。

export type RecruitmentDirectoryChannel = "official_site" | "wechat";

export type DefaultCompanyDirectoryEntry = {
  identityKey: string;
  companyName: string;
  companyType: string;
  industry: string;
  channel: RecruitmentDirectoryChannel;
  channelLabel: string;
  entryUrl: string;
  publishedAt?: string | null;
};

export const DEFAULT_COMPANY_DIRECTORY =
  defaultDirectoryData.directory as readonly DefaultCompanyDirectoryEntry[];

export function publicDefaultCompanyDirectory() {
  return DEFAULT_COMPANY_DIRECTORY.map(
    ({
      identityKey,
      companyName,
      industry,
      channel,
      channelLabel,
      entryUrl,
    }) => ({
      identityKey,
      companyName,
      industry,
      channel,
      channelLabel,
      websiteUrl: entryUrl,
    }),
  );
}
