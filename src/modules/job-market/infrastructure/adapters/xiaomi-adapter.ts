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
    const rows: XiaomiJob[] = [];
    let total = 0;
    let pageNum = 1;

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
      rows.push(...page.slice(0, itemLimit - rows.length));
      pageNum += 1;
      if (!page.length) break;
    } while (rows.length < Math.min(total, itemLimit));

    const normalized = normalizeItems(
      source,
      rows.map((job) => ({
        id: job.jobPostId ?? job.id,
        title: job.title,
        locations: job.cityZhNames,
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
        total > rows.length ? ("partial" as const) : ("complete" as const),
      sourceMetadata: { fetchedAt: context.now },
      ...normalized,
    };
  }
}
