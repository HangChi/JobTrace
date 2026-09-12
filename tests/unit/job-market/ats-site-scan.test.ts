import { describe, expect, it } from "vitest";
import {
  extractBoardHits,
  DEFAULT_SITE_SCAN_QUERIES,
} from "@/modules/job-market/application/ats-site-scan";

describe("extractBoardHits", () => {
  it("keeps high-confidence ATS boards with extractable company names", () => {
    const { hits, skipped } = extractBoardHits([
      {
        title: "比亚迪社会招聘 - Moka",
        url: "https://app.mokahr.com/social-recruitment/byd",
      },
      {
        title: "博世中国招聘 SmartRecruiters",
        url: "https://jobs.smartrecruiters.com/BoschGroup",
      },
      {
        title: "哈啰官方招聘",
        url: "https://hellobike.zhiye.com/social/jobs",
      },
    ]);
    expect(hits.map((hit) => hit.detected.adapter)).toEqual([
      "moka",
      "smartrecruiters",
      "beisen",
    ]);
    expect(hits.map((hit) => hit.companyName)).toEqual([
      "比亚迪",
      "博世中国",
      "哈啰",
    ]);
    expect(skipped).toBe(0);
  });

  it("skips non-ATS results, duplicates and unextractable names", () => {
    const { hits, skipped } = extractBoardHits([
      { title: "随便什么新闻", url: "https://www.example.com/jobs" },
      {
        title: "比亚迪社会招聘 - Moka",
        url: "https://app.mokahr.com/social-recruitment/byd",
      },
      {
        title: "比亚迪校园招聘 - Moka",
        url: "https://app.mokahr.com/campus-recruitment/byd",
      },
      { title: "招聘官网汇总", url: "https://app.mokahr.com/social-recruitment/xyz" },
    ]);
    // 同一 Moka 租户的社招/校招是不同板子（externalKey 不同），都保留。
    expect(hits.length).toBe(2);
    expect(skipped).toBe(2);
  });

  it("ships a default site query set covering major ATS hosts", () => {
    const joined = DEFAULT_SITE_SCAN_QUERIES.join(" ");
    expect(joined).toContain("mokahr.com");
    expect(joined).toContain("smartrecruiters.com");
    expect(joined).toContain("zhiye.com");
    expect(DEFAULT_SITE_SCAN_QUERIES.length).toBeGreaterThanOrEqual(4);
  });
});
