import { load } from "cheerio";
import type { SecureSourceFetch, SourceFetchResponse } from "./ports";
import { BROWSER_HEADERS } from "./browser-http";
import { detectSourceCandidate } from "./source-discovery";

// B 方案研究核心：给定公司名，从公开网页搜索（360 so.com，结果直出真实
// URL）找到招聘官网，用与来源发现一致的 detectSourceCandidate 判定 ATS。
// 研究产物进入候选队列，经管理员批准后才成为目录条目与来源。

export type WebSearchResult = {
  title: string;
  url: string;
};

export type ResearchedSite = {
  url: string;
  finalUrl: string;
  httpStatus: number | null;
  detected: ReturnType<typeof detectSourceCandidate>;
  error: string | null;
};

export type CompanyResearch = {
  companyName: string;
  results: WebSearchResult[];
  verified: ResearchedSite[];
  best: ResearchedSite | null;
};

// 聚合平台、新闻门户与搜索内部域名：研究目标只能是公司自有或 ATS 托管的招聘页。
const BLOCKED_RESULT_HOSTS = [
  "zhipin.com",
  "liepin.com",
  "zhaopin.com",
  "51job.com",
  "lagou.com",
  "linkedin.com",
  "indeed.com",
  "glassdoor.com",
  "mp.weixin.qq.com",
  "weixin.sogou.com",
  "hao.360.com",
  "ranks.hao.360.com",
  "wenda.so.com",
  "baike.so.com",
  "video.360kan.com",
  "tv.360kan.com",
  "xiaohongshu.com",
  "douyin.com",
  "zhihu.com",
  "weibo.com",
  "tieba.baidu.com",
  "baike.baidu.com",
  "sohu.com",
  "163.com",
  "126.com",
  "sina.com.cn",
  "sina.com",
  "qq.com",
  "ifeng.com",
  "thepaper.cn",
  "xinhuanet.com",
  "people.com.cn",
  "peopleapp.com",
  "cctv.com",
  "cntv.cn",
  "toutiao.com",
  "jiemian.com",
  "36kr.com",
  "ithome.com",
  "cnbeta.com",
  "cnbeta.com.cn",
  "eastmoney.com",
  "10jqka.com.cn",
  "xueqiu.com",
  "wikipedia.org",
  "baike.so.com",
];

export function parseSoResults(html: string): WebSearchResult[] {
  const $ = load(html);
  const results: WebSearchResult[] = [];
  const seen = new Set<string>();
  $("h3 a[data-mdurl]").each((_index, element) => {
    const url = ($(element).attr("data-mdurl") ?? "").replace(/&amp;/g, "&");
    const title = $(element).text().trim();
    if (!url || !title) return;
    if (!/^https?:\/\//.test(url)) return;
    if (seen.has(url)) return;
    seen.add(url);
    results.push({ title, url });
  });
  return results;
}

export function filterRecruitmentResults(results: WebSearchResult[]) {
  return results
    .map((result) => ({
      ...result,
      // 结果偶有 http 链接；统一升级 https 交给验证阶段把关。
      url: result.url.replace(/^http:\/\//i, "https://"),
    }))
    .filter((result) => {
      let host: string;
      try {
        host = new URL(result.url).hostname.toLowerCase();
      } catch {
        return false;
      }
      if (
        !host.endsWith(".cn") &&
        !host.endsWith(".com") &&
        !host.endsWith(".net")
      )
        return false;
      if (
        BLOCKED_RESULT_HOSTS.some(
          (blocked) => host === blocked || host.endsWith(`.${blocked}`),
        )
      )
        return false;
      if (
        !/招聘|校招|社招|招募|人才|talent|career|job|hire|join/i.test(
          result.title,
        ) &&
        !/job|career|talent|hire|zhaopin|recruit|hr/i.test(result.url)
      )
        return false;
      return true;
    });
}

export async function searchWeb(
  query: string,
  fetcher: SecureSourceFetch,
): Promise<WebSearchResult[]> {
  const fetchOnce = async () => {
    let response;
    try {
      response = await fetcher(
        `https://www.so.com/s?q=${encodeURIComponent(query)}`,
        {
          allowedHosts: ["www.so.com"],
          signal: AbortSignal.timeout(15000),
          accept: ["text/html"],
          headers: BROWSER_HEADERS,
        },
      );
    } catch (error) {
      // 限流时 302 跳验证码域（跨主机）被安全客户端拦截；重试无意义。
      const message = error instanceof Error ? error.message : "";
      if (message.includes("outside the approved"))
        throw new Error("search_engine_blocked");
      throw error;
    }
    if (response.status !== 200)
      throw new Error(`so_com_http_${response.status}`);
    return parseSoResults(await response.text());
  };
  try {
    return await fetchOnce();
  } catch (error) {
    if (error instanceof Error && error.message === "search_engine_blocked")
      throw error;
    // 连续查询易触发瞬时限流，稍候重试一次。
    await new Promise((resolve) => setTimeout(resolve, 2500));
    return fetchOnce();
  }
}

function isSafeHttpsUrl(raw: string) {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

export async function verifySite(
  url: string,
  fetcher: SecureSourceFetch,
): Promise<ResearchedSite> {
  const site: ResearchedSite = {
    url,
    finalUrl: url,
    httpStatus: null,
    detected: null,
    error: null,
  };
  try {
    let current = url;
    let response: SourceFetchResponse | null = null;
    const visited = new Set([url]);
    for (let hop = 0; hop < 6; hop++) {
      // 研究对象是任意外部站点；逐跳把当前主机名加入白名单，
      // 安全客户端的 SSRF/https 校验对每一跳仍然生效。
      response = await fetcher(current, {
        allowedHosts: [new URL(current).hostname.toLowerCase()],
        signal: AbortSignal.timeout(20000),
        accept: ["text/html", "application/xhtml+xml"],
        headers: BROWSER_HEADERS,
      });
      const location = response.headers.get("location");
      if ([301, 302, 303, 307, 308].includes(response.status) && location) {
        const next = new URL(location, current).href;
        if (new URL(next).protocol !== "https:" || visited.has(next)) {
          site.finalUrl = current;
          site.error = "redirect_stopped";
          break;
        }
        visited.add(next);
        current = next;
        continue;
      }
      site.finalUrl = current;
      break;
    }
    if (response) {
      site.httpStatus = response.status;
      if (response.status >= 200 && response.status < 400) {
        const html = await response.text().catch(() => "");
        site.detected = detectSourceCandidate(
          site.finalUrl,
          html.slice(0, 500000),
        );
      } else {
        site.error = `http_${response.status}`;
      }
    }
  } catch (error) {
    site.error = error instanceof Error ? error.name : "fetch_failed";
  }
  // 抓取失败时回退到纯 URL 模式判定：已知 ATS 域名（moka/zhiye 等）无需
  // 页面 HTML 即可判定，实际同步走 ATS API，不受页面可达性影响。
  if (!site.detected && !site.error?.startsWith("http_")) {
    site.detected = detectSourceCandidate(site.finalUrl);
  }
  return site;
}

export async function researchCompanySite(
  companyName: string,
  dependencies: { fetcher: SecureSourceFetch; maxCandidates?: number },
): Promise<CompanyResearch> {
  const results = filterRecruitmentResults(
    await searchWeb(`${companyName} 招聘官网`, dependencies.fetcher),
  );
  const candidates = results
    .map((result) => result.url)
    .filter(isSafeHttpsUrl)
    .slice(0, dependencies.maxCandidates ?? 5);
  const verified: ResearchedSite[] = [];
  for (const candidate of candidates) {
    const site = await verifySite(candidate, dependencies.fetcher);
    verified.push(site);
    // 命中已知 ATS 即停止：排序靠前的结果几乎总是正确的官方入口。
    if (site.detected?.confidence === "high") break;
  }
  const rank = { high: 0, medium: 1, none: 2 } as const;
  verified.sort(
    (left, right) =>
      rank[left.detected?.confidence ?? "none"] -
      rank[right.detected?.confidence ?? "none"],
  );
  return {
    companyName,
    results,
    verified,
    best: verified.find((site) => site.detected) ?? verified[0] ?? null,
  };
}
