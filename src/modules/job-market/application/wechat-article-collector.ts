import { load } from "cheerio";
import type { SecureSourceFetch } from "./ports";

// 微信公众号是国内新公司发布招聘最快的公开信号。采集器从公开搜索引擎
// 的微信文章索引中拉取招聘类文章标题，提取公司名后交由候选队列审核。
// 两个引擎互为备份：搜狗微信搜索覆盖最全但反爬激进，必应索引较稳。

export type WechatArticleHit = {
  title: string;
  url: string;
  snippet: string | null;
  publishedAt: string | null;
  engine: "sogou" | "bing";
};

export type EngineStatus = {
  engine: "sogou" | "bing";
  status: "ok" | "blocked" | "error";
  articles: number;
  detail: string | null;
};

export const DEFAULT_COLLECT_QUERIES = [
  "校园招聘",
  "2027届校招",
  "社会招聘",
  "秋招启动",
  "招聘公告",
  "实习招聘",
] as const;

const RECRUITMENT_KEYWORDS =
  /招聘|校招|社招|秋招|春招|实习|内推|网申|宣讲会|join\s*us|hiring/i;

const GENERIC_NAMES = new Set([
  "招聘",
  "校园招聘",
  "社会招聘",
  "公司",
  "集团",
  "我们",
  "岗位",
  "最新",
  "重磅",
  "热招",
  "急招",
  "诚聘",
  "高薪",
  "国企",
  "央企",
  "事业单位",
  "央企直招",
  "国企直招",
  "招聘信息",
  "招聘公告",
  "招聘啦",
  "直招",
  "直聘",
  "速递",
  "汇总",
  "合集",
  "精选",
  "资讯",
]);

// 常见省市区域词整词出现时几乎一定是地域标签而非公司名
// （「【湖南招聘】中联重科…」），作为整词候选降权；作前缀不受影响。
const REGION_NAMES = new Set(
  ("北京 上海 天津 重庆 河北 山西 内蒙古 辽宁 吉林 黑龙江 江苏 浙江 安徽 福建 江西 山东 河南 湖北 " +
    "湖南 广东 广西 海南 四川 贵州 云南 西藏 陕西 甘肃 青海 宁夏 新疆 香港 澳门 台湾 " +
    "深圳 广州 杭州 南京 成都 武汉 西安 苏州 厦门 青岛 长沙 郑州 合肥 昆明 大连 宁波 无锡 佛山 东莞 " +
    "全球 全国 华北 华南 华东 西南 西北 东北 各地")
    .split(" "),
);

const NOISE_PREFIX =
  /^(信息|公告|启事|启动|开启|全面|正式|首发|直招|直聘|急聘|热招|诚聘|重磅|速递|汇总|合集|精选|最新|官方|权威|大厂|名企|国企|央企|年度|专场)+/;

const COMPANY_SUFFIX =
  /(集团|公司|有限公司|责任公司|控股|科技|技术|银行|证券|基金|保险|人寿|财险|资管|期货|信托|医院|研究所|研究院|设计院|大学|学院|学校|重工|电气|汽车|电子|半导体|芯片|生物|医药|医疗|能源|电力|通信|网络|软件|数字|智能|航空|航天|船舶|轨道交通|地产|置业|建筑|传媒|文化|教育|咨询|投资|资本|实业|股份|工厂|矿业|化工|材料|环境|食品|服饰|商贸|物流)/;

const TITLE_KEYWORDS =
  /社会招聘|校园招聘|实习招聘|全球招聘|招聘|校招|社招|秋招|春招|实习|内推|网申|宣讲会|join\s*us|hiring/gi;

function stripDecorations(value: string) {
  return value
    .replace(/[【】\[\]「」『』《》<>（）()｜|·•—\-_/\\,，。:：!！?？~～*"'\s]+/g, " ")
    .trim();
}

function cleanSegment(segment: string): string {
  return stripDecorations(
    segment
      .replace(/(19|20)\d{2}\s*[-~至]?\s*(届|年)?/g, " ")
      .replace(/第\s*\d+\s*届/g, " ")
      .replace(/\b(19|20)\d{2}\b/g, " ")
      .replace(/^[年届期度]+\s*/, ""),
  );
}

// 标题里公司名可能位于招聘关键词之前、之后或两段关键词之间
// （如「招聘信息|泰康人寿2027届校园招聘」）。把标题按关键词切段，
// 对每段做时间/噪声清洗后按「含企业后缀 > 长度适中 > 非通用词」打分。
export function extractCompanyFromTitle(title: string): string | null {
  const normalized = stripDecorations(title);
  if (!normalized || normalized.length > 120) return null;
  if (!RECRUITMENT_KEYWORDS.test(normalized)) return null;

  const matches = [...normalized.matchAll(TITLE_KEYWORDS)];
  if (!matches.length) return null;
  const bounds = [
    0,
    ...matches.flatMap((match) =>
      match.index === undefined
        ? []
        : [match.index, match.index + match[0].length],
    ),
    normalized.length,
  ];
  const segments: string[] = [];
  for (let index = 0; index + 1 < bounds.length; index += 2) {
    const segment = cleanSegment(
      normalized.slice(bounds[index], bounds[index + 1]),
    );
    if (segment) segments.push(segment);
  }

  const scored = segments
    .flatMap((segment) => {
      const meaningful = segment
        .split(" ")
        .filter(Boolean)
        .filter(
          (token) =>
            !REGION_NAMES.has(token) &&
            !GENERIC_NAMES.has(token) &&
            !/^\d+人?$/.test(token),
        );
      if (!meaningful.length) return [];
      return meaningful.length > 1
        ? [
            ...meaningful
              .filter((token) => COMPANY_SUFFIX.test(token))
              .map((token) => ({ candidate: token, origin: segments.indexOf(segment) })),
            { candidate: meaningful.join(" "), origin: segments.indexOf(segment) },
          ]
        : [{ candidate: meaningful[0], origin: segments.indexOf(segment) }];
    })
    .filter(({ candidate }) => {
      if (candidate.length < 2 || candidate.length > 30) return false;
      if (GENERIC_NAMES.has(candidate) || /^\d+$/.test(candidate)) return false;
      if (!/[\p{Script=Han}a-zA-Z]/u.test(candidate)) return false;
      return true;
    })
    .map(({ candidate, origin }) => {
      let score = candidate.length >= 3 && candidate.length <= 20 ? 2 : 1;
      if (COMPANY_SUFFIX.test(candidate)) score += 4;
      if (NOISE_PREFIX.test(candidate)) score -= 3;
      if (REGION_NAMES.has(candidate)) score -= 4;
      // 多词段落（如「120人 庆铃集团」）让位给其中的企业后缀词。
      const tokens = candidate.split(" ").filter(Boolean);
      if (tokens.length > 1) score -= tokens.length - 1;
      // 平分时偏向前段：公司名几乎总在招聘关键词之前。
      score += segments.length - origin;
      return { candidate, score };
    })
    .sort((left, right) => right.score - left.score);

  const best = scored[0];
  if (!best || best.score < 1) return null;
  return best.candidate.replace(NOISE_PREFIX, "").trim() || null;
}

function parseSogouArticles(html: string): WechatArticleHit[] {
  const $ = load(html);
  const hits: WechatArticleHit[] = [];
  $("h3 a[target='_blank']").each((_index, element) => {
    const title = $(element).text().trim();
    if (!title) return;
    const item = $(element).closest("div, li");
    const snippet = item.find(".txt-info").text().trim() || null;
    const timeText = item.find(".s-p").text().trim();
    hits.push({
      title,
      // /link 跳转有反爬且几小时后过期；存按标题关键词检索的持久链接，
      // 审核时可据此找到原文。
      url: `https://weixin.sogou.com/weixin?type=2&query=${encodeURIComponent(title.slice(0, 30))}`,
      snippet: snippet ? snippet.slice(0, 500) : null,
      publishedAt: parseSogouTime(timeText),
      engine: "sogou",
    });
  });
  return hits;
}

function parseSogouTime(value: string): string | null {
  const absolute = value.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (absolute) {
    const [, year, month, day] = absolute;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T00:00:00+08:00`;
  }
  const monthDay = value.match(/(\d{1,2})月(\d{1,2})日/);
  if (monthDay) {
    const year = new Date().getFullYear();
    return `${year}-${monthDay[1].padStart(2, "0")}-${monthDay[2].padStart(2, "0")}T00:00:00+08:00`;
  }
  return null;
}

// Bing 将结果链接包装为 bing.com/ck/a?...&u=a1<base64url>，解开还原真实地址。
function unwrapBingUrl(href: string): string | null {
  const direct = /^https:\/\/mp\.weixin\.qq\.com\//.test(href);
  if (direct) return href;
  const match = href.match(/[?&]u=a1([A-Za-z0-9_-]+)/);
  if (!match) return null;
  try {
    const decoded = Buffer.from(
      match[1].replaceAll("-", "+").replaceAll("_", "/"),
      "base64",
    ).toString("utf8");
    return /^https:\/\/mp\.weixin\.qq\.com\//.test(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

function parseBingArticles(html: string): WechatArticleHit[] {
  const $ = load(html);
  const hits: WechatArticleHit[] = [];
  $("li.b_algo h2 a").each((_index, element) => {
    const href = $(element).attr("href") ?? "";
    const title = $(element).text().trim();
    if (!title) return;
    const url = unwrapBingUrl(href);
    if (!url) return;
    const container = $(element).closest("li.b_algo");
    const snippet = container.find(".b_caption p").text().trim() || null;
    hits.push({
      title,
      url,
      snippet: snippet ? snippet.slice(0, 500) : null,
      publishedAt: null,
      engine: "bing",
    });
  });
  return hits;
}

const BROWSER_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "accept-language": "zh-CN,zh;q=0.9",
};

async function fetchSogou(
  query: string,
  fetcher: SecureSourceFetch,
): Promise<{ hits: WechatArticleHit[]; status: EngineStatus["status"]; detail: string | null }> {
  const url = `https://weixin.sogou.com/weixin?type=2&query=${encodeURIComponent(query)}`;
  try {
    const response = await fetcher(url, {
      allowedHosts: ["weixin.sogou.com"],
      signal: AbortSignal.timeout(15000),
      accept: ["text/html"],
      headers: BROWSER_HEADERS,
    });
    const html = await response.text();
    if (response.status !== 200 || /antispider|captcha|验证码/i.test(html)) {
      return {
        hits: [],
        status: "blocked",
        detail: `sogou http_${response.status}${/antispider|captcha|验证码/i.test(html) ? "_captcha" : ""}`,
      };
    }
    return { hits: parseSogouArticles(html), status: "ok", detail: null };
  } catch (error) {
    return {
      hits: [],
      status: "error",
      detail: error instanceof Error ? error.name : "fetch_failed",
    };
  }
}

async function fetchBing(
  query: string,
  fetcher: SecureSourceFetch,
): Promise<{ hits: WechatArticleHit[]; status: EngineStatus["status"]; detail: string | null }> {
  const url = `https://www.bing.com/search?q=${encodeURIComponent(`site:mp.weixin.qq.com ${query}`)}&setlang=zh-hans`;
  try {
    const response = await fetcher(url, {
      allowedHosts: ["www.bing.com"],
      signal: AbortSignal.timeout(15000),
      accept: ["text/html"],
      headers: BROWSER_HEADERS,
    });
    const html = await response.text();
    if (response.status !== 200) {
      return { hits: [], status: "error", detail: `bing http_${response.status}` };
    }
    const hits = parseBingArticles(html);
    return { hits, status: "ok", detail: hits.length ? null : "no_wechat_results" };
  } catch (error) {
    return {
      hits: [],
      status: "error",
      detail: error instanceof Error ? error.name : "fetch_failed",
    };
  }
}

export async function collectWechatArticles(
  queries: readonly string[],
  dependencies: { fetcher: SecureSourceFetch },
): Promise<{ hits: WechatArticleHit[]; engines: EngineStatus[] }> {
  const perEngine: Record<
    "sogou" | "bing",
    { ok: number; articles: number; blocked: string | null }
  > = {
    sogou: { ok: 0, articles: 0, blocked: null },
    bing: { ok: 0, articles: 0, blocked: null },
  };
  const hits: WechatArticleHit[] = [];
  const seenTitles = new Set<string>();

  for (const query of queries) {
    const [sogou, bing] = await Promise.all([
      fetchSogou(query, dependencies.fetcher),
      fetchBing(query, dependencies.fetcher),
    ]);
    for (const result of [
      { engine: "sogou" as const, ...sogou },
      { engine: "bing" as const, ...bing },
    ]) {
      if (result.status === "ok") {
        perEngine[result.engine].ok += 1;
        perEngine[result.engine].articles += result.hits.length;
        for (const hit of result.hits)
          if (!seenTitles.has(hit.title)) {
            seenTitles.add(hit.title);
            hits.push(hit);
          }
      } else if (result.status === "blocked") {
        perEngine[result.engine].blocked ??= result.detail;
      }
    }
  }

  const engines: EngineStatus[] = (["sogou", "bing"] as const).map((engine) => {
    const state = perEngine[engine];
    if (state.ok > 0)
      return { engine, status: "ok", articles: state.articles, detail: null };
    return {
      engine,
      status: state.blocked ? "blocked" : "error",
      articles: 0,
      detail: state.blocked ?? "all_queries_failed",
    };
  });
  return { hits, engines };
}
