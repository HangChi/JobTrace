import { describe, expect, it } from "vitest";
import {
  isAutoApprovable,
  AUTO_APPROVE_ADAPTERS,
} from "@/modules/job-market/application/auto-approval-policy";

describe("isAutoApprovable", () => {
  it("approves only machine-detected site-scan candidates with proven adapters", () => {
    expect(
      isAutoApprovable({
        sourceEngine: "site_scan",
        adapter: "moka",
        confidence: "high",
      }),
    ).toBe(true);
    expect(
      isAutoApprovable({
        evidenceCode: "ats_site_scan",
        adapter: "beisen",
        confidence: "high",
      }),
    ).toBe(true);
  });

  it("rejects human-extracted, low-confidence and unproven adapters", () => {
    // 公众号采集（人名提取）永不自动转正。
    expect(
      isAutoApprovable({ sourceEngine: "sogou", adapter: "moka", confidence: "high" }),
    ).toBe(false);
    // 中置信/无检测不算。
    expect(
      isAutoApprovable({ sourceEngine: "site_scan", adapter: "moka", confidence: "medium" }),
    ).toBe(false);
    expect(
      isAutoApprovable({ sourceEngine: "site_scan", adapter: null, confidence: null }),
    ).toBe(false);
    // 飞书已退役、html/schema 解析面宽，不自动启用。
    expect(
      isAutoApprovable({ sourceEngine: "site_scan", adapter: "feishu", confidence: "high" }),
    ).toBe(false);
    expect(
      isAutoApprovable({ sourceEngine: "site_scan", adapter: "html_list", confidence: "high" }),
    ).toBe(false);
  });

  it("keeps the auto-approve adapter allowlist aligned with proven adapters", () => {
    expect(AUTO_APPROVE_ADAPTERS.has("moka")).toBe(true);
    expect(AUTO_APPROVE_ADAPTERS.has("smartrecruiters")).toBe(true);
    expect(AUTO_APPROVE_ADAPTERS.has("feishu")).toBe(false);
  });
});
