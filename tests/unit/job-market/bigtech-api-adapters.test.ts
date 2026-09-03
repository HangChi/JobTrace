import { describe, expect, it } from "vitest";
import { ChinaBigTechAdapter } from "@/modules/job-market/infrastructure/adapters/china-bigtech-adapter";
import type { SecureSourceFetch } from "@/modules/job-market/application/ports";
import type { JobMarketSource } from "@/modules/job-market/domain/entities";

function source(
  externalKey: string,
  baseUrl: string,
): JobMarketSource {
  return {
    id: "source",
    companyId: "company",
    companyName: "测试企业",
    adapter: "china_bigtech",
    externalKey,
    baseUrl,
    allowedHosts: [new URL(baseUrl).hostname],
    countryCodes: ["cn"],
    isOfficial: true,
    accessBasis: "public",
    status: "active",
    syncIntervalMinutes: 360,
    consecutiveFailures: 0,
    etag: null,
    lastModified: null,
  };
}

function response(value: unknown, contentType = "application/json") {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return {
    status: 200,
    headers: new Headers({ "content-type": contentType }),
    text: async () => text,
    json: async () => JSON.parse(text) as unknown,
  };
}

const context = {
  runId: "run",
  now: new Date("2026-09-03T00:00:00.000Z"),
  maxItems: 20,
};

describe("China big-tech API providers", () => {
  it("normalizes ByteDance social-recruitment posts", async () => {
    const fetcher: SecureSourceFetch = async (url, options) => {
      expect(String(url)).toBe(
        "https://jobs.bytedance.com/api/v1/search/job/posts",
      );
      expect(options.method).toBe("POST");
      const body = JSON.parse(String(options.body));
      expect(body.portal_type).toBe(1);
      expect(body.offset).toBe(0);
      return response({
        code: 0,
        message: "ok",
        data: {
          count: 1,
          job_post_list: [
            {
              id: "7677825761898694917",
              title: "大模型推荐算法工程师",
              description: "负责推荐算法研发",
              requirement: "本科及以上学历",
              job_category: { name: "算法" },
              recruit_type: { name: "正式" },
              city_list: [{ name: "北京" }, { name: "上海" }],
              city_info: { name: "北京" },
              publish_time: 1787633184920,
            },
          ],
        },
      });
    };
    const batch = await new ChinaBigTechAdapter(fetcher).fetch(
      source("bytedance", "https://jobs.bytedance.com/"),
      context,
      new AbortController().signal,
    );
    expect(batch.jobs).toHaveLength(1);
    expect(batch.jobs[0]).toMatchObject({
      title: "大模型推荐算法工程师",
      campaignName: "算法",
      recruitmentType: "正式",
      detailUrl:
        "https://jobs.bytedance.com/experienced/position/7677825761898694917/detail",
    });
    expect(batch.jobs[0]!.locations.map((item) => item.name)).toEqual([
      "北京",
      "上海",
    ]);
    expect(batch.jobs[0]!.publishedAt?.toISOString()).toBe(
      "2026-08-25T04:46:24.920Z",
    );
  });

  it("defaults missing recruit_type to social recruitment", async () => {
    const fetcher: SecureSourceFetch = async () =>
      response({
        code: 0,
        data: {
          count: 1,
          job_post_list: [
            {
              id: "123",
              title: "后端工程师",
              city_list: [{ name: "杭州" }],
            },
          ],
        },
      });
    const batch = await new ChinaBigTechAdapter(fetcher).fetch(
      source("bytedance", "https://jobs.bytedance.com/"),
      context,
      new AbortController().signal,
    );
    expect(batch.jobs[0]).toMatchObject({
      recruitmentType: "社会招聘",
      detailUrl: "https://jobs.bytedance.com/experienced/position/123/detail",
    });
  });

  it("normalizes Huawei job pages with the required gateway headers", async () => {
    const fetcher: SecureSourceFetch = async (url, options) => {
      expect(String(url)).toBe(
        "https://apigw-dgg-b0.huawei.com/api/apig/channelhw/recruitmentPosition/pub/getJobPage?X-HW-ID=app_000000035886",
      );
      expect(options.headers).toMatchObject({
        "x-jalor-tenantAlias": "hcm",
        Referer: "https://career.huawei.com/cn",
      });
      expect(JSON.parse(String(options.body))).toEqual({
        curPage: 1,
        pageSize: 10,
        jobType: "SR",
      });
      return response({
        status: "SUCCESS",
        data: {
          pageVO: { totalRows: 1 },
          result: [
            {
              jobId: 103891,
              jobName: "AI Infra工程师",
              jobRequire: "本科及以上学历",
              mainBusiness: "负责 AI 基础设施建设",
              categoryName: "研发类",
              workPlace: "苏州/杭州/北京",
              lastUpdateDate: "2026-08-17",
            },
          ],
        },
      });
    };
    const batch = await new ChinaBigTechAdapter(fetcher).fetch(
      source("huawei|sr", "https://apigw-dgg-b0.huawei.com/"),
      context,
      new AbortController().signal,
    );
    expect(batch.jobs).toHaveLength(1);
    expect(batch.jobs[0]).toMatchObject({
      title: "AI Infra工程师",
      campaignName: "研发类",
      recruitmentType: "社会招聘",
    });
    expect(batch.jobs[0]!.locations.map((item) => item.name)).toEqual([
      "苏州",
      "杭州",
      "北京",
    ]);
  });

  it("rejects a non-SUCCESS Huawei gateway response", async () => {
    const fetcher: SecureSourceFetch = async () =>
      response({ status: "TenantContextError", data: null });
    await expect(
      new ChinaBigTechAdapter(fetcher).fetch(
        source("huawei|cr", "https://apigw-dgg-b0.huawei.com/"),
        context,
        new AbortController().signal,
      ),
    ).rejects.toThrow(/invalid response/i);
  });

  it("normalizes NetEase queryPage results", async () => {
    const fetcher: SecureSourceFetch = async (url, options) => {
      expect(String(url)).toBe(
        "https://hr.163.com/api/hr163/position/queryPage",
      );
      expect(JSON.parse(String(options.body))).toMatchObject({
        currentPage: 1,
        pageSize: 10,
      });
      return response({
        code: 200,
        data: {
          total: 1,
          list: [
            {
              id: 78603,
              name: "资深制片（漫威争锋）",
              description: "统筹CG项目全流程",
              requirement: "5年以上经验",
              firstPostTypeName: "游戏艺术",
              productName: "网易游戏（互娱）",
              reqEducationName: "不限",
              workPlaceNameList: ["杭州"],
              updateTime: 1788412520000,
            },
          ],
        },
      });
    };
    const batch = await new ChinaBigTechAdapter(fetcher).fetch(
      source("netease", "https://hr.163.com/"),
      context,
      new AbortController().signal,
    );
    expect(batch.jobs).toHaveLength(1);
    expect(batch.jobs[0]).toMatchObject({
      title: "资深制片(漫威争锋)",
      campaignName: "网易游戏(互娱)",
      education: "不限",
      detailUrl: "https://hr.163.com/job-detail.html?id=78603",
    });
    expect(batch.jobs[0]!.publishedAt?.toISOString()).toBe(
      "2026-09-03T05:15:20.000Z",
    );
  });

  it("normalizes miHoYo social jobs with campus/social channels", async () => {
    const fetcher: SecureSourceFetch = async (url, options) => {
      expect(String(url)).toBe(
        "https://ats.openout.mihoyo.com/ats-portal/v1/job/list",
      );
      expect(options.headers).toMatchObject({
        Origin: "https://jobs.mihoyo.com",
      });
      expect(JSON.parse(String(options.body))).toEqual({
        pageNo: 1,
        pageSize: 10,
        channelDetailIds: [1],
        hireType: 0,
      });
      return response({
        code: 0,
        data: {
          total: 1,
          list: [
            {
              id: "5737",
              title: "怪物模型-源初之结",
              addressDetailList: [{ addressDetail: "上海", addressId: "8" }],
              competencyType: "美术&表现类",
              projectName: "社会招聘",
              objectName: "",
              jobSummary: "",
              jobNature: "全职",
            },
          ],
        },
      });
    };
    const batch = await new ChinaBigTechAdapter(fetcher).fetch(
      source("mihoyo|social", "https://ats.openout.mihoyo.com/"),
      context,
      new AbortController().signal,
    );
    expect(batch.jobs).toHaveLength(1);
    expect(batch.jobs[0]).toMatchObject({
      title: "怪物模型-源初之结",
      campaignName: "社会招聘",
      recruitmentType: "社会招聘",
      detailUrl: "https://jobs.mihoyo.com/#/position",
    });
    expect(batch.jobs[0]!.locations.map((item) => item.name)).toEqual(["上海"]);
  });

  it("requests hireType=1 for mihoyo|campus", async () => {
    const fetcher: SecureSourceFetch = async (_url, options) => {
      const body = JSON.parse(String(options.body));
      expect(body.hireType).toBe(1);
      return response({
        code: 0,
        data: {
          total: 1,
          list: [
            {
              id: "9078",
              title: "AI产品经理",
              addressDetailList: [{ addressDetail: "上海" }],
              projectName: "2027届秋招",
              objectName: "2027届（2026.9-2027.8之间毕业）",
            },
          ],
        },
      });
    };
    const batch = await new ChinaBigTechAdapter(fetcher).fetch(
      source("mihoyo|campus", "https://ats.openout.mihoyo.com/"),
      context,
      new AbortController().signal,
    );
    expect(batch.jobs[0]).toMatchObject({
      campaignName: "2027届秋招",
      recruitmentType: "校园招聘",
      batchLabel: "2027届(2026.9-2027.8之间毕业)",
      detailUrl: "https://jobs.mihoyo.com/#/campus/position",
    });
  });

  it("paginates ByteDance until maxItems is reached", async () => {
    const pages = [
      Array.from({ length: 10 }, (_value, index) => ({
        id: `job-1-${index}`,
        title: `职位 1-${index}`,
        city_list: [{ name: "北京" }],
      })),
      Array.from({ length: 5 }, (_value, index) => ({
        id: `job-2-${index}`,
        title: `职位 2-${index}`,
        city_list: [{ name: "北京" }],
      })),
    ];
    let calls = 0;
    const fetcher: SecureSourceFetch = async () => {
      const page = pages[Math.min(calls, pages.length - 1)];
      calls += 1;
      return response({
        code: 0,
        data: { count: 15, job_post_list: page },
      });
    };
    const batch = await new ChinaBigTechAdapter(fetcher).fetch(
      source("bytedance", "https://jobs.bytedance.com/"),
      { ...context, maxItems: 15 },
      new AbortController().signal,
    );
    expect(calls).toBe(2);
    expect(batch.jobs).toHaveLength(15);
  });
});
