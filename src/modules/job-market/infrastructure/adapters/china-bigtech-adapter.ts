import { SourceError } from "../../application/source-errors";
import type { SecureSourceFetch, SourceAdapter } from "../../application/ports";
import type { JobMarketSource } from "../../domain/entities";
import { fetchHtmlJobList } from "./html-list-adapter";
import { normalizeItems } from "./shared";

export class ChinaBigTechAdapter implements SourceAdapter {
  readonly kind = "china_bigtech" as const;
  constructor(private readonly fetcher: SecureSourceFetch) {}

  async fetch(
    source: JobMarketSource,
    context: { runId: string; now: Date; maxItems: number },
    signal: AbortSignal,
  ) {
    if (source.externalKey === "tencent")
      return this.fetchTencent(source, context, signal);
    if (source.externalKey === "jd")
      return this.fetchJd(source, context, signal);
    if (source.externalKey === "baidu")
      return this.fetchBaidu(source, context, signal);
    if (["alibaba", "meituan"].includes(source.externalKey))
      return fetchHtmlJobList(this.fetcher, source, context, signal);
    throw new SourceError(
      "invalid_source_payload",
      "Unknown China big-tech provider key",
    );
  }

  private async fetchBaidu(
    source: JobMarketSource,
    context: { now: Date; maxItems: number },
    signal: AbortSignal,
  ) {
    const response = await this.fetcher(source.baseUrl, {
      allowedHosts: source.allowedHosts,
      signal,
      accept: ["text/html", "application/xhtml+xml"],
    });
    const html = await response.text();
    const encoded = html.match(
      /window\.__INITIAL_DATA__\s*=\s*(\{[\s\S]*?\});\s*window\.prefix/,
    )?.[1];
    if (!encoded)
      throw new SourceError(
        "invalid_source_payload",
        "Baidu careers page did not expose its public job data",
      );
    let initial: unknown;
    try {
      initial = JSON.parse(encoded) as unknown;
    } catch {
      throw new SourceError(
        "invalid_source_payload",
        "Baidu careers job data is invalid",
      );
    }
    const found: Array<Record<string, unknown>> = [];
    const visit = (value: unknown) => {
      if (found.length >= context.maxItems) return;
      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }
      if (!value || typeof value !== "object") return;
      const record = value as Record<string, unknown>;
      if (
        typeof record.name === "string" &&
        (typeof record.jobId === "string" || typeof record.postId === "string")
      )
        found.push(record);
      Object.values(record).forEach(visit);
    };
    visit(initial);
    const unique = [
      ...new Map(
        found.map((job) => [String(job.jobId ?? job.postId), job]),
      ).values(),
    ];
    if (!unique.length)
      throw new SourceError(
        "invalid_source_payload",
        "Baidu careers page returned no recognizable jobs",
      );
    const listingUrl = "https://talent.baidu.com/jobs/list";
    return {
      completeness: "partial" as const,
      sourceMetadata: { fetchedAt: context.now },
      ...normalizeItems(
        source,
        unique.map((job) => {
          const title = String(job.name ?? "");
          const location = title.includes("-") ? title.split("-")[0] : null;
          return {
            id: job.jobId ?? job.postId,
            title,
            locations: location,
            campaign: job.postType,
            recruitmentType: job.postType,
            education: job.education,
            description:
              job.jobDescription ?? job.serviceCondition ?? job.description,
            detailUrl: listingUrl,
            applyUrl: listingUrl,
            publishedAt: job.updateDate ?? job.publishDate,
          };
        }),
      ),
    };
  }

  private async fetchTencent(
    source: JobMarketSource,
    context: { now: Date; maxItems: number },
    signal: AbortSignal,
  ) {
    const pageSize = Math.min(100, context.maxItems);
    const rows: Array<Record<string, unknown>> = [];
    let total = 0;
    while (rows.length < context.maxItems) {
      const endpoint = new URL("/tencentcareer/api/post/Query", source.baseUrl);
      endpoint.searchParams.set(
        "pageIndex",
        String(rows.length / pageSize + 1),
      );
      endpoint.searchParams.set("pageSize", String(pageSize));
      endpoint.searchParams.set("language", "zh-cn");
      endpoint.searchParams.set("area", "cn");
      const response = await this.fetcher(endpoint.href, {
        allowedHosts: source.allowedHosts,
        signal,
        accept: ["application/json"],
      });
      const payload = (await response.json()) as {
        Code?: number;
        Data?: { Count?: number; Posts?: Array<Record<string, unknown>> };
      };
      if (payload.Code !== 200 || !Array.isArray(payload.Data?.Posts))
        throw new SourceError(
          "invalid_source_payload",
          "Tencent careers API returned an invalid response",
        );
      total = Number(payload.Data.Count ?? payload.Data.Posts.length);
      rows.push(...payload.Data.Posts.slice(0, context.maxItems - rows.length));
      if (!payload.Data.Posts.length || rows.length >= total) break;
    }
    return {
      completeness:
        rows.length < total ? ("partial" as const) : ("complete" as const),
      sourceMetadata: { fetchedAt: context.now },
      ...normalizeItems(
        source,
        rows.map((job) => {
          const id = job.PostId;
          const detailUrl = id
            ? `https://careers.tencent.com/jobdesc.html?postId=${encodeURIComponent(String(id))}`
            : null;
          return {
            id,
            title: job.RecruitPostName,
            locations: job.LocationName,
            campaign: job.BGName,
            recruitmentType: job.RequireWorkYearsName,
            description: job.Responsibility,
            detailUrl,
            applyUrl: detailUrl,
            publishedAt: job.LastUpdateTime,
            closed: job.IsValid === false,
          };
        }),
      ),
    };
  }

  private async fetchJd(
    source: JobMarketSource,
    context: { now: Date; maxItems: number },
    signal: AbortSignal,
  ) {
    const pageSize = Math.min(50, context.maxItems);
    const rows: Array<Record<string, any>> = [];
    let total = 0;
    while (rows.length < context.maxItems) {
      const endpoint = new URL(
        "/api/wx/position/page?type=present",
        source.baseUrl,
      );
      const response = await this.fetcher(endpoint.href, {
        allowedHosts: source.allowedHosts,
        signal,
        accept: ["application/json"],
        method: "POST",
        body: JSON.stringify({
          pageSize,
          pageIndex: Math.floor(rows.length / pageSize),
          parameter: {
            positionName: "",
            planIdList: [],
            jobDirectionCodeList: [],
            workCityCodeList: [],
            positionDeptList: [],
          },
        }),
        headers: { "Content-Type": "application/json" },
      });
      const payload = (await response.json()) as {
        success?: boolean;
        body?: { totalNumber?: number; items?: Array<Record<string, any>> };
      };
      if (!payload.success || !Array.isArray(payload.body?.items))
        throw new SourceError(
          "invalid_source_payload",
          "JD careers API returned an invalid response",
        );
      total = Number(payload.body.totalNumber ?? payload.body.items.length);
      rows.push(...payload.body.items.slice(0, context.maxItems - rows.length));
      if (!payload.body.items.length || rows.length >= total) break;
    }
    return {
      completeness:
        rows.length < total ? ("partial" as const) : ("complete" as const),
      sourceMetadata: { fetchedAt: context.now },
      ...normalizeItems(
        source,
        rows.map((job) => {
          const detailUrl = job.publishId
            ? `https://campus.jd.com/#/details?id=${encodeURIComponent(String(job.publishId))}`
            : "https://campus.jd.com/#/jobs";
          const requirements = Array.isArray(job.requirementVoList)
            ? job.requirementVoList
            : [];
          return {
            id: job.publishId ?? job.reqId,
            title: job.positionName,
            locations: requirements.map(
              (item: Record<string, unknown>) => item.workCity,
            ),
            campaign: "校园招聘",
            recruitmentType: "校园招聘",
            description: [job.workContent, job.qualification]
              .filter((value): value is string => typeof value === "string")
              .join("\n\n"),
            detailUrl,
            applyUrl: detailUrl,
            publishedAt: job.publishTime,
            preserveUrlHash: true,
          };
        }),
      ),
    };
  }
}
