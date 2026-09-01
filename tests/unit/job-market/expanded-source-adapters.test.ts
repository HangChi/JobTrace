import { describe, expect, it } from "vitest";
import { BeisenAdapter } from "@/modules/job-market/infrastructure/adapters/beisen-adapter";
import { WorkdayAdapter } from "@/modules/job-market/infrastructure/adapters/workday-adapter";
import { ChinaBigTechAdapter } from "@/modules/job-market/infrastructure/adapters/china-bigtech-adapter";
import { HtmlListAdapter } from "@/modules/job-market/infrastructure/adapters/html-list-adapter";
import type { SecureSourceFetch } from "@/modules/job-market/application/ports";
import type { JobMarketSource } from "@/modules/job-market/domain/entities";

function source(
  adapter: JobMarketSource["adapter"],
  externalKey: string,
  baseUrl: string,
): JobMarketSource {
  return {
    id: "source",
    companyId: "company",
    companyName: "测试企业",
    adapter,
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
  now: new Date("2026-09-01T00:00:00.000Z"),
  maxItems: 20,
};

describe("expanded domestic recruitment adapters", () => {
  it("normalizes Beisen public job pages", async () => {
    const fetcher: SecureSourceFetch = async (_url, options) => {
      expect(options.method).toBe("POST");
      return response({
        Code: 200,
        Count: 1,
        Data: [
          {
            Id: "job-1",
            JobAdName: "机器人算法工程师",
            LocNames: ["浙江省·杭州市"],
            Category: "校园招聘",
            Duty: "负责算法开发",
            Require: "本科及以上",
            PostDate: "2026-08-31T10:00:00",
            Status: 1,
          },
        ],
      });
    };
    const batch = await new BeisenAdapter(fetcher).fetch(
      source("beisen", "unitree.zhiye.com", "https://unitree.zhiye.com/"),
      context,
      new AbortController().signal,
    );
    expect(batch.jobs).toHaveLength(1);
    expect(batch.jobs[0]).toMatchObject({
      title: "机器人算法工程师",
      recruitmentType: "校园招聘",
    });
  });

  it("normalizes China-scoped Workday jobs", async () => {
    const fetcher: SecureSourceFetch = async (_url, options) => {
      expect(options.body).toContain('"searchText":"China"');
      return response({
        total: 1,
        jobPostings: [
          {
            title: "GPU 软件工程师 - China",
            externalPath: "/job/China-Shanghai/GPU_JR1",
            locationsText: "China, Shanghai",
            bulletFields: ["JR1"],
          },
        ],
      });
    };
    const batch = await new WorkdayAdapter(fetcher).fetch(
      source(
        "workday",
        "nvidia|NVIDIAExternalCareerSite|en-US",
        "https://nvidia.wd5.myworkdayjobs.com/",
      ),
      context,
      new AbortController().signal,
    );
    expect(batch.jobs[0].applyUrl).toContain(
      "/en-US/NVIDIAExternalCareerSite/job/China-Shanghai/GPU_JR1",
    );
  });

  it("normalizes Tencent and JD public APIs", async () => {
    const tencentFetcher: SecureSourceFetch = async () =>
      response({
        Code: 200,
        Data: {
          Count: 1,
          Posts: [
            {
              PostId: "t1",
              RecruitPostName: "后台开发工程师",
              LocationName: "深圳",
              BGName: "TEG",
              Responsibility: "负责服务端开发",
              LastUpdateTime: "2026年09月01日",
              IsValid: true,
            },
          ],
        },
      });
    const tencent = await new ChinaBigTechAdapter(tencentFetcher).fetch(
      source("china_bigtech", "tencent", "https://careers.tencent.com/"),
      context,
      new AbortController().signal,
    );
    expect(tencent.jobs[0].applyUrl).toBe(
      "https://careers.tencent.com/jobdesc.html?postId=t1",
    );

    const jdFetcher: SecureSourceFetch = async () =>
      response({
        success: true,
        body: {
          totalNumber: 1,
          items: [
            {
              publishId: 9,
              positionName: "产品经理",
              workContent: "负责产品设计",
              qualification: "本科及以上",
              publishTime: 1784814534000,
              requirementVoList: [{ workCity: "北京市-北京市" }],
            },
          ],
        },
      });
    const jd = await new ChinaBigTechAdapter(jdFetcher).fetch(
      source("china_bigtech", "jd", "https://campus.jd.com/"),
      context,
      new AbortController().signal,
    );
    expect(jd.jobs[0].locations[0].name).toContain("北京");
    expect(jd.jobs[0].applyUrl).toContain("#/details?id=9");
  });

  it("parses ordinary public HTML job lists without executing scripts", async () => {
    const requested: string[] = [];
    const fetcher: SecureSourceFetch = async (url) => {
      requested.push(url);
      return response(
        url.endsWith("page=2")
          ? `<ul>
              <li class="job-item"><a href="/jobs/data">数据工程师</a><span>北京</span></li>
            </ul>`
          : `<ul>
          <li class="job-item"><a href="/jobs/backend">后端工程师</a><span>上海</span></li>
          <li class="job-item"><a href="/jobs/frontend">前端工程师</a><span>深圳</span></li>
          <li class="pagination"><a rel="next" href="?page=2">下一页</a></li>
        </ul>`,
        "text/html",
      );
    };
    const batch = await new HtmlListAdapter(fetcher).fetch(
      source("html_list", "example", "https://careers.example.com/jobs"),
      context,
      new AbortController().signal,
    );
    expect(batch.jobs.map((job) => job.title)).toEqual([
      "后端工程师",
      "前端工程师",
      "数据工程师",
    ]);
    expect(requested).toEqual([
      "https://careers.example.com/jobs",
      "https://careers.example.com/jobs?page=2",
    ]);
    expect(batch.completeness).toBe("complete");
  });
});
