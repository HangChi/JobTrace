import { SourceError } from "../../application/source-errors";
import type { SecureSourceFetch, SourceAdapter } from "../../application/ports";
import type { JobMarketSource } from "../../domain/entities";
import { fetchHtmlJobList } from "./html-list-adapter";
import { normalizeItems } from "./shared";

function epochMillisToDate(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0)
    return null;
  return new Date(value).toISOString();
}

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
    const [provider, channel] = source.externalKey.split("|");
    if (provider === "bytedance")
      return this.fetchBytedance(source, context, signal);
    if (provider === "huawei")
      return this.fetchHuawei(source, context, signal, channel);
    if (provider === "netease")
      return this.fetchNetease(source, context, signal);
    if (provider === "mihoyo")
      return this.fetchMihoyo(source, context, signal, channel);
    if (provider === "dahua")
      return this.fetchDahua(source, context, signal, channel);
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

  private async fetchBytedance(
    source: JobMarketSource,
    context: { now: Date; maxItems: number },
    signal: AbortSignal,
  ) {
    const pageSize = Math.min(10, context.maxItems);
    const rows: Array<Record<string, any>> = [];
    let total = 0;
    while (rows.length < context.maxItems) {
      const endpoint = new URL("/api/v1/search/job/posts", source.baseUrl);
      const response = await this.fetcher(endpoint.href, {
        allowedHosts: source.allowedHosts,
        signal,
        accept: ["application/json"],
        method: "POST",
        body: JSON.stringify({
          keyword: "",
          limit: pageSize,
          offset: rows.length,
          job_category_id_list: [],
          tag_id_list: [],
          location_code_list: [],
          subject_id_list: [],
          recruitment_type_id_list: [],
          portal_type: 1,
          portal_entrance: 1,
        }),
        headers: { "Content-Type": "application/json" },
      });
      const payload = (await response.json()) as {
        code?: number;
        data?: {
          count?: number;
          job_post_list?: Array<Record<string, any>>;
        };
      };
      if (payload.code !== 0 || !Array.isArray(payload.data?.job_post_list))
        throw new SourceError(
          "invalid_source_payload",
          "ByteDance careers API returned an invalid response",
        );
      total = Number(payload.data.count ?? payload.data.job_post_list.length);
      rows.push(
        ...payload.data.job_post_list.slice(0, context.maxItems - rows.length),
      );
      if (!payload.data.job_post_list.length || rows.length >= total) break;
    }
    return {
      completeness:
        rows.length < total ? ("partial" as const) : ("complete" as const),
      sourceMetadata: { fetchedAt: context.now },
      ...normalizeItems(
        source,
        rows.map((job) => {
          const id = job.id == null ? null : String(job.id);
          const detailUrl = id
            ? `https://jobs.bytedance.com/experienced/position/${id}/detail`
            : null;
          return {
            id,
            title: job.title,
            locations: [
              ...(Array.isArray(job.city_list) ? job.city_list : []),
              job.city_info,
            ].filter(Boolean),
            campaign: job.job_category?.name,
            recruitmentType: job.recruit_type?.name ?? "社会招聘",
            description: [job.description, job.requirement]
              .filter(
                (value): value is string =>
                  typeof value === "string" && value.trim().length > 0,
              )
              .join("\n\n"),
            detailUrl,
            applyUrl: detailUrl,
            publishedAt: epochMillisToDate(job.publish_time),
          };
        }),
      ),
    };
  }

  private async fetchHuawei(
    source: JobMarketSource,
    context: { now: Date; maxItems: number },
    signal: AbortSignal,
    channel: string,
  ) {
    const campus = channel === "cr";
    const pageSize = Math.min(10, context.maxItems);
    const rows: Array<Record<string, any>> = [];
    let total = 0;
    while (rows.length < context.maxItems) {
      const endpoint = new URL(
        "/api/apig/channelhw/recruitmentPosition/pub/getJobPage",
        source.baseUrl,
      );
      endpoint.searchParams.set("X-HW-ID", "app_000000035886");
      const response = await this.fetcher(endpoint.href, {
        allowedHosts: source.allowedHosts,
        signal,
        accept: ["application/json"],
        method: "POST",
        body: JSON.stringify({
          curPage: Math.floor(rows.length / pageSize) + 1,
          pageSize,
          jobType: campus ? "CR" : "SR",
        }),
        headers: {
          "Content-Type": "application/json",
          "X-HW-ID": "app_000000035886",
          "x-jalor-tenantAlias": "hcm",
          "x-language": "zh_CN",
          "x-alb-gray": "prod",
          "x-Referer": "https://career.huawei.com/cn",
          Referer: "https://career.huawei.com/cn",
        },
      });
      const payload = (await response.json()) as {
        status?: string;
        data?: {
          pageVO?: { totalRows?: number };
          result?: Array<Record<string, any>>;
        };
      };
      if (payload.status !== "SUCCESS" || !Array.isArray(payload.data?.result))
        throw new SourceError(
          "invalid_source_payload",
          "Huawei careers API returned an invalid response",
        );
      total = Number(
        payload.data.pageVO?.totalRows ?? payload.data.result.length,
      );
      rows.push(
        ...payload.data.result.slice(0, context.maxItems - rows.length),
      );
      if (!payload.data.result.length || rows.length >= total) break;
    }
    const listingUrl = campus
      ? "https://career.huawei.com/cn/campus-recruitment-job-list"
      : "https://career.huawei.com/cn/social-recruitment-job-list";
    return {
      completeness:
        rows.length < total ? ("partial" as const) : ("complete" as const),
      sourceMetadata: { fetchedAt: context.now },
      ...normalizeItems(
        source,
        rows.map((job) => {
          const id = job.jobId == null ? null : String(job.jobId);
          return {
            id,
            title: job.jobName,
            locations: String(job.workPlace ?? "")
              .split(/[/、;；]/)
              .map((city) => city.trim())
              .filter(Boolean),
            campaign: job.categoryName,
            recruitmentType: campus ? "校园招聘" : "社会招聘",
            description: [job.mainBusiness, job.jobRequire]
              .filter(
                (value): value is string =>
                  typeof value === "string" && value.trim().length > 0,
              )
              .join("\n\n"),
            detailUrl: id
              ? `${listingUrl}?jobId=${encodeURIComponent(id)}`
              : listingUrl,
            applyUrl: listingUrl,
            publishedAt: job.lastUpdateDate,
          };
        }),
      ),
    };
  }

  private async fetchNetease(
    source: JobMarketSource,
    context: { now: Date; maxItems: number },
    signal: AbortSignal,
  ) {
    const pageSize = Math.min(10, context.maxItems);
    const rows: Array<Record<string, any>> = [];
    let total = 0;
    while (rows.length < context.maxItems) {
      const endpoint = new URL("/api/hr163/position/queryPage", source.baseUrl);
      const response = await this.fetcher(endpoint.href, {
        allowedHosts: source.allowedHosts,
        signal,
        accept: ["application/json"],
        method: "POST",
        body: JSON.stringify({
          currentPage: Math.floor(rows.length / pageSize) + 1,
          pageSize,
          keyword: "",
          queryChannel: 0,
        }),
        headers: {
          "Content-Type": "application/json",
          Referer: "https://hr.163.com/job-list.html",
        },
      });
      const payload = (await response.json()) as {
        code?: number;
        data?: {
          total?: number;
          list?: Array<Record<string, any>>;
        };
      };
      if (payload.code !== 200 || !Array.isArray(payload.data?.list))
        throw new SourceError(
          "invalid_source_payload",
          "NetEase careers API returned an invalid response",
        );
      total = Number(payload.data.total ?? payload.data.list.length);
      rows.push(...payload.data.list.slice(0, context.maxItems - rows.length));
      if (!payload.data.list.length || rows.length >= total) break;
    }
    const listingUrl = "https://hr.163.com/job-list.html";
    return {
      completeness:
        rows.length < total ? ("partial" as const) : ("complete" as const),
      sourceMetadata: { fetchedAt: context.now },
      ...normalizeItems(
        source,
        rows.map((job) => {
          const id = job.id == null ? null : String(job.id);
          const detailUrl = id
            ? `https://hr.163.com/job-detail.html?id=${encodeURIComponent(id)}`
            : listingUrl;
          return {
            id,
            title: job.name,
            locations: [
              ...(Array.isArray(job.workPlaceNameList)
                ? job.workPlaceNameList
                : []),
              ...(Array.isArray(job.workPlaceList) ? job.workPlaceList : []),
            ],
            campaign: job.productName ?? job.firstPostTypeName,
            recruitmentType: job.recruitTypeName ?? "社会招聘",
            education: job.reqEducationName,
            description: [job.description, job.requirement]
              .filter(
                (value): value is string =>
                  typeof value === "string" && value.trim().length > 0,
              )
              .join("\n\n"),
            detailUrl,
            applyUrl: detailUrl,
            publishedAt: epochMillisToDate(job.updateTime),
          };
        }),
      ),
    };
  }

  private async fetchMihoyo(
    source: JobMarketSource,
    context: { now: Date; maxItems: number },
    signal: AbortSignal,
    channel: string,
  ) {
    const campus = channel === "campus";
    const pageSize = Math.min(10, context.maxItems);
    const rows: Array<Record<string, any>> = [];
    let total = 0;
    while (rows.length < context.maxItems) {
      const endpoint = new URL("/ats-portal/v1/job/list", source.baseUrl);
      const response = await this.fetcher(endpoint.href, {
        allowedHosts: source.allowedHosts,
        signal,
        accept: ["application/json"],
        method: "POST",
        body: JSON.stringify({
          pageNo: Math.floor(rows.length / pageSize) + 1,
          pageSize,
          channelDetailIds: [1],
          hireType: campus ? 1 : 0,
        }),
        headers: {
          "Content-Type": "application/json",
          Origin: "https://jobs.mihoyo.com",
          Referer: "https://jobs.mihoyo.com/",
        },
      });
      const payload = (await response.json()) as {
        code?: number;
        data?: {
          total?: number;
          list?: Array<Record<string, any>>;
        };
      };
      if (payload.code !== 0 || !Array.isArray(payload.data?.list))
        throw new SourceError(
          "invalid_source_payload",
          "miHoYo careers API returned an invalid response",
        );
      total = Number(payload.data.total ?? payload.data.list.length);
      rows.push(...payload.data.list.slice(0, context.maxItems - rows.length));
      if (!payload.data.list.length || rows.length >= total) break;
    }
    const listingUrl = campus
      ? "https://jobs.mihoyo.com/#/campus/position"
      : "https://jobs.mihoyo.com/#/position";
    return {
      completeness:
        rows.length < total ? ("partial" as const) : ("complete" as const),
      sourceMetadata: { fetchedAt: context.now },
      ...normalizeItems(
        source,
        rows.map((job) => ({
          id: job.id,
          title: job.title,
          locations: (Array.isArray(job.addressDetailList)
            ? job.addressDetailList
            : []
          )
            .map((item: Record<string, unknown>) => item.addressDetail)
            .filter(Boolean),
          campaign: job.projectName,
          recruitmentType: campus ? "校园招聘" : "社会招聘",
          batch: job.objectName,
          description: job.jobSummary,
          detailUrl: listingUrl,
          applyUrl: listingUrl,
          preserveUrlHash: true,
        })),
      ),
    };
  }

  private async fetchDahua(
    source: JobMarketSource,
    context: { now: Date; maxItems: number },
    signal: AbortSignal,
    channel: string,
  ) {
    const campus = channel === "campus";
    const endpoint = new URL(
      "/talent-pool/api/bs-info/list-position-by-search",
      source.baseUrl,
    );
    const response = await this.fetcher(endpoint.href, {
      allowedHosts: source.allowedHosts,
      signal,
      accept: ["application/json"],
      method: "POST",
      body: JSON.stringify({
        companyCategory: "",
        positionCategory: "",
        workPlaceCode: "",
        recruitType: campus ? "2" : "1",
      }),
      headers: {
        "Content-Type": "application/json",
        Origin: "https://job.dahuatech.com",
        Referer: "https://job.dahuatech.com/",
      },
    });
    const payload = (await response.json()) as {
      code?: number;
      data?: Array<Record<string, any>>;
    };
    if (payload.code !== 200 || !Array.isArray(payload.data))
      throw new SourceError(
        "invalid_source_payload",
        "Dahua careers API returned an invalid response",
      );
    const rows = payload.data.slice(0, context.maxItems);
    const listingUrl = campus
      ? "https://job.dahuatech.com/#/CampusPosition?id=1"
      : "https://job.dahuatech.com/#/SocietyPosition?id=3";
    return {
      completeness:
        payload.data.length > rows.length
          ? ("partial" as const)
          : ("complete" as const),
      sourceMetadata: { fetchedAt: context.now },
      ...normalizeItems(
        source,
        rows.map((job) => ({
          id: job.jobAdIntId ?? job.jobAdId,
          title: job.jobAdName,
          locations: job.workingPlace,
          campaign: job.jobCategroyDescription ?? job.companyName,
          recruitmentType: campus ? "校园招聘" : "社会招聘",
          batch: job.companyName,
          description: [job.duty, job.require]
            .filter(
              (value): value is string =>
                typeof value === "string" && value.trim().length > 0,
            )
            .join("\n\n"),
          detailUrl: listingUrl,
          applyUrl: listingUrl,
          publishedAt: job.publishDate ?? job.postDate,
          preserveUrlHash: true,
        })),
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
