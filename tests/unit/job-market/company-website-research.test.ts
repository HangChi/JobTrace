import { describe, expect, it } from "vitest";
import {
  parseSoResults,
  filterRecruitmentResults,
  researchCompanySite,
} from "@/modules/job-market/application/company-website-research";
import type { SecureSourceFetch } from "@/modules/job-market/application/ports";

const SO_FIXTURE = `
<div class="res-list">
  <h3 class="res-title"><a data-mdurl="https://hellobike.zhiye.com/" target="_blank">哈啰官方招聘</a></h3>
  <h3 class="res-title"><a data-mdurl="https://www.zhipin.com/gongsi/472c.html" target="_blank">「哈啰出行招聘」-BOSS直聘</a></h3>
  <h3 class="res-title"><a data-mdurl="https://jobs.example.com.cn/social" target="_blank">哈啰出行社会招聘官网</a></h3>
  <h3 class="res-title"><a data-mdurl="https://hellobike.zhiye.com/" target="_blank">重复结果应去重</a></h3>
  <h3 class="res-title"><a href="/link?normal">无 mdurl 的结果</a></h3>
</div>`;

describe("parseSoResults", () => {
  it("extracts real urls from data-mdurl and dedupes", () => {
    const results = parseSoResults(SO_FIXTURE);
    expect(results.map((item) => item.url)).toEqual([
      "https://hellobike.zhiye.com/",
      "https://www.zhipin.com/gongsi/472c.html",
      "https://jobs.example.com.cn/social",
    ]);
  });
});

describe("filterRecruitmentResults", () => {
  const make = (url: string, title: string) => ({ url, title });

  it("keeps ATS and official sites, drops aggregators and noise", () => {
    const kept = filterRecruitmentResults([
      make("https://hellobike.zhiye.com/", "哈啰官方招聘"),
      make("https://jobs.example.com.cn/social", "哈啰出行社会招聘官网"),
      make("https://www.zhipin.com/gongsi/x", "「哈啰招聘」BOSS直聘"),
      make("https://liepin.com/gongsi/x", "猎聘哈啰"),
      make("https://mp.weixin.qq.com/s/abc", "哈啰招聘公众号文章"),
      make("https://news.example.com/", "哈啰完成新一轮融资"),
      make("https://m.thepaper.cn/baijiahao_1", "哈啰人才招募"),
      make("http://www.example.org.cn/join", "哈啰招聘官网"),
    ]);
    expect(kept.map((item) => item.url)).toEqual([
      "https://hellobike.zhiye.com/",
      "https://jobs.example.com.cn/social",
      // http 结果统一升级为 https 后放行。
      "https://www.example.org.cn/join",
    ]);
  });
});

describe("researchCompanySite", () => {
  it("verifies candidates and prefers a detected ATS", async () => {
    const fetcher: SecureSourceFetch = async (url) => {
      if (url.startsWith("https://www.so.com/"))
        return {
          status: 200,
          headers: new Headers(),
          text: async () => SO_FIXTURE,
          json: async () => ({}),
        };
      return {
        status: 200,
        headers: new Headers(),
        text: async () => "<html><body>jobs</body></html>",
        json: async () => ({}),
      };
    };
    const research = await researchCompanySite("哈啰", { fetcher });
    // 第一个候选是北森 ATS：URL 模式即高置信，应立即命中并停止。
    expect(research.best?.finalUrl).toBe("https://hellobike.zhiye.com/");
    expect(research.best?.detected?.adapter).toBe("beisen");
    expect(research.best?.detected?.confidence).toBe("high");
  });
});
