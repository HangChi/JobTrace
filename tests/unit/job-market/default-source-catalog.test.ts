import { describe, expect, it } from "vitest";
import { DEFAULT_SOURCE_CATALOG } from "@/modules/job-market/application/default-source-catalog";
import { DEFAULT_COMPANY_DIRECTORY } from "@/modules/job-market/application/default-company-directory";

describe("default job-market source catalog", () => {
  it("contains unique, bounded, public HTTPS sources", () => {
    expect(DEFAULT_SOURCE_CATALOG.length).toBeGreaterThanOrEqual(200);
    expect(
      new Set(DEFAULT_SOURCE_CATALOG.map((entry) => entry.identityKey)).size,
    ).toBe(DEFAULT_SOURCE_CATALOG.length);
    expect(
      new Set(
        DEFAULT_SOURCE_CATALOG.map(
          (entry) => `${entry.adapter}:${entry.externalKey}`,
        ),
      ).size,
    ).toBe(DEFAULT_SOURCE_CATALOG.length);

    for (const entry of DEFAULT_SOURCE_CATALOG) {
      const sourceUrl = new URL(entry.baseUrl);
      const websiteUrl = new URL(entry.websiteUrl);
      expect(sourceUrl.protocol).toBe("https:");
      expect(websiteUrl.protocol).toBe("https:");
      expect(entry.allowedHosts).toContain(sourceUrl.hostname);
      expect(entry.countryCodes).toEqual(["cn"]);
      expect(entry.syncIntervalMinutes).toBe(360);
    }

    expect(
      DEFAULT_SOURCE_CATALOG.filter((entry) => entry.companyType !== "外企")
        .length,
    ).toBeGreaterThan(DEFAULT_SOURCE_CATALOG.length / 2);
  });

  it("adds a broad domestic directory without treating directory entries as automatic sources", () => {
    expect(
      DEFAULT_SOURCE_CATALOG.length + DEFAULT_COMPANY_DIRECTORY.length,
    ).toBeGreaterThanOrEqual(300);
    expect(
      new Set([
        ...DEFAULT_SOURCE_CATALOG.map((entry) => entry.identityKey),
        ...DEFAULT_COMPANY_DIRECTORY.map((entry) => entry.identityKey),
      ]).size,
    ).toBe(DEFAULT_SOURCE_CATALOG.length + DEFAULT_COMPANY_DIRECTORY.length);

    for (const entry of DEFAULT_COMPANY_DIRECTORY) {
      expect(new URL(entry.entryUrl).protocol).toBe("https:");
      if (entry.channel === "wechat") {
        expect(new URL(entry.entryUrl).hostname).toBe("mp.weixin.qq.com");
        expect(entry.channelLabel).toBe("公众号招聘原文");
        expect(entry.publishedAt).toMatch(/^2026-08-/);
      } else {
        expect(entry.channel).toBe("official_site");
        expect(entry.channelLabel).toBe("官方招聘网站");
      }
    }

    expect(
      DEFAULT_COMPANY_DIRECTORY.filter(
        (entry) => entry.channel === "official_site",
      ).length,
    ).toBeGreaterThanOrEqual(6);
    expect(
      DEFAULT_COMPANY_DIRECTORY.filter((entry) => entry.channel === "wechat")
        .length,
    ).toBeGreaterThanOrEqual(1_000);
  });

  it("fills verified gaps from the public graduate-recruitment tracker", () => {
    const automaticCompanies = new Set(
      DEFAULT_SOURCE_CATALOG.map((entry) => entry.companyName),
    );
    expect(automaticCompanies.has("蔚来")).toBe(true);
    expect(automaticCompanies.has("小鹏汽车")).toBe(true);
    expect(automaticCompanies.has("宇树科技")).toBe(true);
    expect(automaticCompanies.has("ASML中国")).toBe(true);

    const directoryByCompany = new Map(
      DEFAULT_COMPANY_DIRECTORY.map((entry) => [entry.companyName, entry]),
    );
    for (const companyName of [
      "DeepSeek",
      "水滴",
      "新东方",
      "汉得信息",
      "德明利",
      "中科飞测",
      "南孚",
      "中信建投证券",
      "中国广核集团",
      "联合利华中国",
    ]) {
      expect(directoryByCompany.get(companyName)?.channel).toBe(
        "official_site",
      );
    }
  });
});
