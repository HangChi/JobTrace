// 高置信自动转正的纯策略定义（无运行时依赖，便于单测）。
// 仅 site: 枚举（机器生成的 ATS 检测，不经过人工命名）且适配器在
// 白名单内的候选可自动转正；公众号采集等人名提取类候选永远人工审核。

// 只自动启用在默认目录中长期稳定运行的适配器；飞书已退役，
// html/schema 解析面太宽，均不自动转正。
export const AUTO_APPROVE_ADAPTERS = new Set([
  "moka",
  "beisen",
  "smartrecruiters",
  "greenhouse",
  "lever",
  "workday",
  "job51",
  "dayee",
  "xiaomi",
  "china_bigtech",
]);

export type AutoApproveCandidateFields = {
  adapter: string | null;
  confidence: string | null;
  evidenceCode?: string;
  sourceEngine?: string;
};

export function isAutoApprovable(fields: AutoApproveCandidateFields) {
  const fromSiteScan =
    fields.sourceEngine === "site_scan" ||
    fields.evidenceCode === "ats_site_scan";
  return (
    fromSiteScan &&
    fields.confidence === "high" &&
    fields.adapter !== null &&
    AUTO_APPROVE_ADAPTERS.has(fields.adapter)
  );
}
