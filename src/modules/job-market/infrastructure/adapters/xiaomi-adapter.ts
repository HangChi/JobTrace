import type { SecureSourceFetch, SourceAdapter } from "../../application/ports";
import type { JobMarketSource } from "../../domain/entities";
import { fetchJson, normalizeItems } from "./shared";

type XiaomiJob = {
  id?: unknown;
  title?: unknown;
  cityZhNames?: unknown;
  description?: unknown;
  requirement?: unknown;
  publishTime?: unknown;
  type?: unknown;
  url?: unknown;
  jobPostId?: unknown;
};

const MAINLAND_LOCATIONS = new Set(
  `三亚 三明 上海 上饶 东莞 东营 中山 临汾 临沂 乌鲁木齐 乐山 九江 云浮 仙桃
   佛山 保定 信阳 兰州 内江 凉山 包头 北京 北海 南京 南充 南宁 南平 南昌 南通
   南阳 厦门 合肥 吉林 吕梁 呼和浩特 咸阳 哈尔滨 唐山 商丘 嘉兴 四平 大同 大庆
   大连 天津 太原 威海 娄底 宁德 宁波 安康 宜宾 宜昌 宜春 宝鸡 宿迁 岳阳 巴中
   常州 常德 广元 广安 广州 廊坊 延安 延边 张家界 徐州 德州 德阳 忻州 怀化 惠州
   成都 扬州 拉萨 揭阳 攀枝花 新乡 新余 无锡 日照 昆明 朔州 杭州 松原 枣庄 柳州
   株洲 桂林 梅州 榆林 武汉 永州 汉中 汕头 汕尾 江门 沈阳 河源 泉州 泰安 泰州
   泸州 洛阳 济南 济宁 海口 淄博 淮安 深圳 清远 温州 渭南 湘潭 湘西 湛江 滨州
   漳州 潍坊 烟台 玉林 珠海 琼海 白城 白山 百色 益阳 盐城 眉山 石家庄 福州 绍兴
   绵阳 聊城 肇庆 自贡 芜湖 苏州 莆田 菏泽 衡阳 襄阳 西宁 西安 许昌 贵港 贵阳
   资阳 赣州 赤峰 辽源 达州 运城 连云港 通化 遂宁 邯郸 邵阳 郑州 郴州 鄂尔多斯
   重庆 银川 镇江 长春 长沙 阳江 阳泉 雅安 青岛 韶关 龙岩`.split(/\s+/),
);

function mainlandLocations(value: unknown) {
  const locations = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : typeof value === "string"
      ? [value]
      : [];
  return locations.filter((item) =>
    MAINLAND_LOCATIONS.has(
      item
        .normalize("NFKC")
        .trim()
        .replace(/(?:市|自治州|地区|盟)$/u, ""),
    ),
  );
}

const recruitmentType = (value: unknown) =>
  ({ 1: "社会招聘", 2: "校园招聘", 3: "实习", 4: "顶尖人才" })[Number(value)] ??
  null;

export class XiaomiAdapter implements SourceAdapter {
  readonly kind = "xiaomi" as const;
  constructor(private readonly fetcher: SecureSourceFetch) {}

  async fetch(
    source: JobMarketSource,
    context: { runId: string; now: Date; maxItems: number },
    signal: AbortSignal,
  ) {
    const itemLimit = Math.min(100, context.maxItems);
    const pageSize = itemLimit;
    const rows: Array<XiaomiJob & { mainlandLocations: string[] }> = [];
    let total = 0;
    let pageNum = 1;
    let scanned = 0;

    do {
      const url = new URL("api/agent/searchJobPage", source.baseUrl);
      url.searchParams.set("keyword", "");
      url.searchParams.set("cityZhNames", "");
      url.searchParams.set("pageSize", String(pageSize));
      url.searchParams.set("pageNum", String(pageNum));
      const response = await fetchJson(this.fetcher, source, url.href, signal);
      const body = (await response.json()) as {
        code?: number;
        data?: { list?: XiaomiJob[]; total?: number };
      };
      if (body.code !== 0 || !body.data)
        throw new Error("Xiaomi jobs API returned an invalid response");
      const page = body.data.list ?? [];
      total = body.data.total ?? page.length;
      scanned += page.length;
      rows.push(
        ...page
          .map((job) => ({
            ...job,
            mainlandLocations: mainlandLocations(job.cityZhNames),
          }))
          .filter((job) => job.mainlandLocations.length > 0)
          .slice(0, itemLimit - rows.length),
      );
      pageNum += 1;
      if (!page.length) break;
    } while (rows.length < itemLimit && scanned < total);

    const normalized = normalizeItems(
      source,
      rows.map((job) => ({
        id: job.jobPostId ?? job.id,
        title: job.title,
        locations: job.mainlandLocations,
        campaign: "中国区在招岗位",
        recruitmentType: recruitmentType(job.type),
        description: [job.description, job.requirement]
          .filter((value): value is string => typeof value === "string")
          .join("\n\n"),
        detailUrl: job.url,
        applyUrl: job.url,
        publishedAt: job.publishTime,
      })),
    );
    return {
      completeness:
        scanned < total ? ("partial" as const) : ("complete" as const),
      sourceMetadata: { fetchedAt: context.now },
      ...normalized,
    };
  }
}
