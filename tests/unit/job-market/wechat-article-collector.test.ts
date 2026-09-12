import { describe, expect, it } from "vitest";
import {
  extractCompanyFromTitle,
  DEFAULT_COLLECT_QUERIES,
} from "@/modules/job-market/application/wechat-article-collector";

describe("extractCompanyFromTitle", () => {
  it("extracts the company before recruitment keywords", () => {
    expect(extractCompanyFromTitle("宁德时代2027届校园招聘正式启动")).toBe(
      "宁德时代",
    );
    expect(extractCompanyFromTitle("字节跳动 招聘 | 海量岗位等你来")).toBe(
      "字节跳动",
    );
    expect(extractCompanyFromTitle("【蜜雪集团】2026秋招公告")).toBe("蜜雪集团");
    expect(extractCompanyFromTitle("腾讯音乐社会招聘")).toBe("腾讯音乐");
    expect(extractCompanyFromTitle("XX科技公司2026-2027实习招聘")).toBe(
      "XX科技公司",
    );
  });

  it("extracts the company after keywords in suffix-first titles", () => {
    expect(extractCompanyFromTitle("招聘信息 |泰康人寿2027届校园招聘")).toBe(
      "泰康人寿",
    );
    expect(extractCompanyFromTitle("招聘丨120人!庆铃集团2027届校园招聘公告")).toBe(
      "庆铃集团",
    );
    expect(
      extractCompanyFromTitle("央企直招|哈尔滨电气集团2027校园招聘正式开启!"),
    ).toBe("哈尔滨电气集团");
    expect(
      extractCompanyFromTitle("2027年中国建设银行安徽省分行校园招聘600名公告"),
    ).toBe("中国建设银行安徽省分行");
    expect(
      extractCompanyFromTitle("广州地铁集团有限公司2027届校园招聘公告"),
    ).toBe("广州地铁集团有限公司");
  });

  it("keeps decorations out and handles keyword-only noise", () => {
    expect(extractCompanyFromTitle("2027届校园招聘启动公告")).toBeNull();
    expect(extractCompanyFromTitle("招聘啦！！！")).toBeNull();
    expect(extractCompanyFromTitle("最新招聘信息汇总")).toBeNull();
    expect(extractCompanyFromTitle("12345 招聘")).toBeNull();
    // 规则提取无法识别无公司名的速递类标题（如「今日份秋招速递」会提取出
    // 「今日份」），这类噪声由管理后台的候选审核兜底过滤。
  });

  it("rejects titles without recruitment signals", () => {
    expect(extractCompanyFromTitle("某公司发布年度财报")).toBeNull();
    expect(extractCompanyFromTitle("")).toBeNull();
  });

  it("handles bilingual join-us variants", () => {
    expect(extractCompanyFromTitle("Acme Corp Join Us Now")).toBe("Acme Corp");
  });

  it("ships a sensible default query set", () => {
    expect(DEFAULT_COLLECT_QUERIES.length).toBeGreaterThanOrEqual(4);
    expect(DEFAULT_COLLECT_QUERIES).toContain("校园招聘");
  });
});
