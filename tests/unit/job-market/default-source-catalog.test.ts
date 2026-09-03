import { readFile } from "node:fs/promises";
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
    expect(automaticCompanies.has("科大讯飞")).toBe(true);
    expect(automaticCompanies.has("ASML中国")).toBe(true);
    expect(automaticCompanies.has("字节跳动")).toBe(true);
    expect(automaticCompanies.has("华为")).toBe(true);
    expect(automaticCompanies.has("网易")).toBe(true);
    expect(automaticCompanies.has("长安汽车")).toBe(true);
    expect(automaticCompanies.has("奇瑞汽车")).toBe(true);
    expect(automaticCompanies.has("上汽通用")).toBe(true);
    expect(automaticCompanies.has("蒙牛集团")).toBe(true);
    expect(automaticCompanies.has("扬子江船业")).toBe(true);
    expect(automaticCompanies.has("中兴通讯")).toBe(true);
    expect(automaticCompanies.has("大华股份")).toBe(true);

    expect(
      DEFAULT_COMPANY_DIRECTORY.some(
        (entry) => entry.companyName === "科大讯飞",
      ),
    ).toBe(false);
    expect(
      DEFAULT_COMPANY_DIRECTORY.some((entry) => entry.companyName === "网易"),
    ).toBe(false);

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

  it("keeps major companies in the directory when no exact-name WeChat article exists", () => {
    const directoryByCompany = new Map(
      DEFAULT_COMPANY_DIRECTORY.map((entry) => [entry.companyName, entry]),
    );
    // 阿里巴巴集团/大疆创新 have no exact-name article and used to be dropped
    // silently; they must fall back to their official careers sites.
    expect(directoryByCompany.get("阿里巴巴集团")).toMatchObject({
      channel: "official_site",
      entryUrl: "https://talent-holding.alibaba.com/off-campus/position-list",
    });
    expect(directoryByCompany.get("大疆创新")).toMatchObject({
      channel: "official_site",
      entryUrl: "https://we.dji.com/zh-CN",
    });
  });

  it("keeps documented directory counts synchronized with the source data", async () => {
    const automaticCompanies = new Set(
      DEFAULT_SOURCE_CATALOG.map((entry) => entry.companyName),
    );
    const [architecture, directory] = await Promise.all([
      readFile("docs/architecture.md", "utf8"),
      readFile("docs/company-directory.md", "utf8"),
    ]);

    expect(architecture).toContain(
      `${automaticCompanies.size} 家可自动同步企业、${DEFAULT_SOURCE_CATALOG.length} 个来源`,
    );
    expect(directory).toContain(
      `## 自动同步公司（${automaticCompanies.size} 家）`,
    );
  });
});
