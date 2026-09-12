import { SourceError } from "../../application/source-errors";
import type { SecureSourceFetch, SourceAdapter } from "../../application/ports";
import type { JobMarketSource } from "../../domain/entities";
import { fetchHtmlJobList } from "./html-list-adapter";
import { normalizeItems, type AdapterJobInput } from "./shared";

function epochMillisToDate(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0)
    return null;
  return new Date(value).toISOString();
}

// ByteDance/华为/网易/米哈游开放接口实测均接受且完整返回 100 条/页
const MAX_API_PAGE_SIZE = 100;

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
    if (source.externalKey === "alibaba")
      return fetchHtmlJobList(this.fetcher, source, context, signal);
    if (source.externalKey === "meituan")
      return this.fetchMeituan(source, context, signal);
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

  // 各大厂开放接口共享的分页模板：page.index 为 0 基页码（ByteDance 用
  // offset，JD 用 0 基页码，其余用 index+1），validate 负责校验响应并
  // 提取本页行数与总数。
  private async fetchPagedPages<TRow>(
    source: JobMarketSource,
    context: { maxItems: number },
    signal: AbortSignal,
    options: {
      pageSize: number;
      request: (page: { index: number; offset: number; pageSize: number }) => {
        url: string;
        init: Omit<Parameters<SecureSourceFetch>[1], "allowedHosts" | "signal">;
      };
      validate: (payload: unknown) => { rows: TRow[]; total: number };
    },
  ): Promise<{ rows: TRow[]; total: number }> {
    const rows: TRow[] = [];
    let total = 0;
    while (rows.length < context.maxItems) {
      const { url, init } = options.request({
        index: Math.floor(rows.length / options.pageSize),
        offset: rows.length,
        pageSize: options.pageSize,
      });
      const response = await this.fetcher(url, {
        allowedHosts: source.allowedHosts,
        signal,
        ...init,
      });
      const result = options.validate(await response.json());
      total = result.total;
      rows.push(...result.rows.slice(0, context.maxItems - rows.length));
      if (!result.rows.length || rows.length >= total) break;
    }
    return { rows, total };
  }

  private buildPagedBatch<TRow>(
    source: JobMarketSource,
    context: { now: Date },
    fetched: { rows: TRow[]; total: number },
    mapper: (row: TRow) => AdapterJobInput,
  ) {
    return {
      completeness:
        fetched.rows.length < fetched.total
          ? ("partial" as const)
          : ("complete" as const),
      sourceMetadata: { fetchedAt: context.now },
      ...normalizeItems(source, fetched.rows.map(mapper)),
    };
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
    const fetched = await this.fetchPagedPages<Record<string, any>>(
      source,
      context,
      signal,
      {
        pageSize: Math.min(MAX_API_PAGE_SIZE, context.maxItems),
        request: ({ offset, pageSize }) => ({
          url: new URL("/api/v1/search/job/posts", source.baseUrl).href,
          init: {
            accept: ["application/json"],
            method: "POST",
            body: JSON.stringify({
              keyword: "",
              limit: pageSize,
              offset,
              job_category_id_list: [],
              tag_id_list: [],
              location_code_list: [],
              subject_id_list: [],
              recruitment_type_id_list: [],
              portal_type: 1,
              portal_entrance: 1,
            }),
            headers: { "Content-Type": "application/json" },
          },
        }),
        validate: (payload) => {
          const typed = payload as {
            code?: number;
            data?: {
              count?: number;
              job_post_list?: Array<Record<string, any>>;
            };
          };
          if (typed.code !== 0 || !Array.isArray(typed.data?.job_post_list))
            throw new SourceError(
              "invalid_source_payload",
              "ByteDance careers API returned an invalid response",
            );
          return {
            rows: typed.data!.job_post_list!,
            total: Number(
              typed.data!.count ?? typed.data!.job_post_list!.length,
            ),
          };
        },
      },
    );
    return this.buildPagedBatch(source, context, fetched, (job) => {
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
    });
  }

  private async fetchHuawei(
    source: JobMarketSource,
    context: { now: Date; maxItems: number },
    signal: AbortSignal,
    channel: string,
  ) {
    const campus = channel === "cr";
    const fetched = await this.fetchPagedPages<Record<string, any>>(
      source,
      context,
      signal,
      {
        pageSize: Math.min(MAX_API_PAGE_SIZE, context.maxItems),
        request: ({ index, pageSize }) => {
          const endpoint = new URL(
            "/api/apig/channelhw/recruitmentPosition/pub/getJobPage",
            source.baseUrl,
          );
          endpoint.searchParams.set("X-HW-ID", "app_000000035886");
          return {
            url: endpoint.href,
            init: {
              accept: ["application/json"],
              method: "POST",
              body: JSON.stringify({
                curPage: index + 1,
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
            },
          };
        },
        validate: (payload) => {
          const typed = payload as {
            status?: string;
            data?: {
              pageVO?: { totalRows?: number };
              result?: Array<Record<string, any>>;
            };
          };
          if (typed.status !== "SUCCESS" || !Array.isArray(typed.data?.result))
            throw new SourceError(
              "invalid_source_payload",
              "Huawei careers API returned an invalid response",
            );
          return {
            rows: typed.data!.result!,
            total: Number(
              typed.data!.pageVO?.totalRows ?? typed.data!.result!.length,
            ),
          };
        },
      },
    );
    const listingUrl = campus
      ? "https://career.huawei.com/cn/campus-recruitment-job-list"
      : "https://career.huawei.com/cn/social-recruitment-job-list";
    return this.buildPagedBatch(source, context, fetched, (job) => {
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
    });
  }

  private async fetchNetease(
    source: JobMarketSource,
    context: { now: Date; maxItems: number },
    signal: AbortSignal,
  ) {
    const fetched = await this.fetchPagedPages<Record<string, any>>(
      source,
      context,
      signal,
      {
        pageSize: Math.min(MAX_API_PAGE_SIZE, context.maxItems),
        request: ({ index, pageSize }) => ({
          url: new URL("/api/hr163/position/queryPage", source.baseUrl).href,
          init: {
            accept: ["application/json"],
            method: "POST",
            body: JSON.stringify({
              currentPage: index + 1,
              pageSize,
              keyword: "",
              queryChannel: 0,
            }),
            headers: {
              "Content-Type": "application/json",
              Referer: "https://hr.163.com/job-list.html",
            },
          },
        }),
        validate: (payload) => {
          const typed = payload as {
            code?: number;
            data?: { total?: number; list?: Array<Record<string, any>> };
          };
          if (typed.code !== 200 || !Array.isArray(typed.data?.list))
            throw new SourceError(
              "invalid_source_payload",
              "NetEase careers API returned an invalid response",
            );
          return {
            rows: typed.data!.list!,
            total: Number(typed.data!.total ?? typed.data!.list!.length),
          };
        },
      },
    );
    const listingUrl = "https://hr.163.com/job-list.html";
    return this.buildPagedBatch(source, context, fetched, (job) => {
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
    });
  }

  private async fetchMeituan(
    source: JobMarketSource,
    context: { now: Date; maxItems: number },
    signal: AbortSignal,
  ) {
    const fetched = await this.fetchPagedPages<Record<string, any>>(
      source,
      context,
      signal,
      {
        pageSize: Math.min(50, context.maxItems),
        request: ({ index, pageSize }) => ({
          url: new URL("/api/official/job/getJobList", source.baseUrl).href,
          init: {
            accept: ["application/json"],
            method: "POST",
            body: JSON.stringify({
              page: { pageNo: index + 1, pageSize },
              jobShareType: "1",
              keywords: "",
              cityList: [],
              department: [],
              jfJgList: [],
              jobType: [{ code: "3", subCode: [] }],
              typeCode: [],
              specialCode: [],
            }),
            headers: {
              "Content-Type": "application/json",
              Origin: "https://job.meituan.com",
              Referer: "https://job.meituan.com/web/social",
            },
          },
        }),
        validate: (payload) => {
          const typed = payload as {
            status?: number;
            data?: {
              list?: Array<Record<string, any>>;
              page?: { totalCount?: number };
            };
          };
          if (typed.status !== 1 || !Array.isArray(typed.data?.list))
            throw new SourceError(
              "invalid_source_payload",
              "Meituan careers API returned an invalid response",
            );
          return {
            rows: typed.data!.list!,
            total: Number(
              typed.data!.page?.totalCount ?? typed.data!.list!.length,
            ),
          };
        },
      },
    );
    const listingUrl = "https://job.meituan.com/web/social";
    return this.buildPagedBatch(source, context, fetched, (job) => {
      const id = job.jobUnionId == null ? null : String(job.jobUnionId).trim();
      const detailUrl = id
        ? `https://job.meituan.com/web/position/detail?jobUnionId=${encodeURIComponent(id)}&highlightType=social`
        : listingUrl;
      return {
        id,
        title: job.name,
        locations: Array.isArray(job.cityList)
          ? job.cityList.map((item: Record<string, unknown>) => item.name)
          : [],
        campaign: Array.isArray(job.department)
          ? job.department
              .map((item: Record<string, unknown>) => item.name)
              .filter(Boolean)
              .join(" / ")
          : job.jobFamily,
        recruitmentType: "社会招聘",
        description: [job.jobDuty, job.jobRequirement, job.highLight]
          .filter(
            (value): value is string =>
              typeof value === "string" && value.trim().length > 0,
          )
          .join("\n\n"),
        detailUrl,
        applyUrl: detailUrl,
        publishedAt: epochMillisToDate(job.refreshTime),
        closed: typeof job.jobStatus === "string" && job.jobStatus !== "000",
      };
    });
  }

  private async fetchMihoyo(
    source: JobMarketSource,
    context: { now: Date; maxItems: number },
    signal: AbortSignal,
    channel: string,
  ) {
    const campus = channel === "campus";
    const fetched = await this.fetchPagedPages<Record<string, any>>(
      source,
      context,
      signal,
      {
        pageSize: Math.min(MAX_API_PAGE_SIZE, context.maxItems),
        request: ({ index, pageSize }) => ({
          url: new URL("/ats-portal/v1/job/list", source.baseUrl).href,
          init: {
            accept: ["application/json"],
            method: "POST",
            body: JSON.stringify({
              pageNo: index + 1,
              pageSize,
              channelDetailIds: [1],
              hireType: campus ? 1 : 0,
            }),
            headers: {
              "Content-Type": "application/json",
              Origin: "https://jobs.mihoyo.com",
              Referer: "https://jobs.mihoyo.com/",
            },
          },
        }),
        validate: (payload) => {
          const typed = payload as {
            code?: number;
            data?: { total?: number; list?: Array<Record<string, any>> };
          };
          if (typed.code !== 0 || !Array.isArray(typed.data?.list))
            throw new SourceError(
              "invalid_source_payload",
              "miHoYo careers API returned an invalid response",
            );
          return {
            rows: typed.data!.list!,
            total: Number(typed.data!.total ?? typed.data!.list!.length),
          };
        },
      },
    );
    const listingUrl = campus
      ? "https://jobs.mihoyo.com/#/campus/position"
      : "https://jobs.mihoyo.com/#/position";
    return this.buildPagedBatch(source, context, fetched, (job) => ({
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
    }));
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
    const fetched = await this.fetchPagedPages<Record<string, unknown>>(
      source,
      context,
      signal,
      {
        pageSize: Math.min(MAX_API_PAGE_SIZE, context.maxItems),
        request: ({ index, pageSize }) => {
          const endpoint = new URL(
            "/tencentcareer/api/post/Query",
            source.baseUrl,
          );
          endpoint.searchParams.set("pageIndex", String(index + 1));
          endpoint.searchParams.set("pageSize", String(pageSize));
          endpoint.searchParams.set("language", "zh-cn");
          endpoint.searchParams.set("area", "cn");
          return { url: endpoint.href, init: { accept: ["application/json"] } };
        },
        validate: (payload) => {
          const typed = payload as {
            Code?: number;
            Data?: { Count?: number; Posts?: Array<Record<string, unknown>> };
          };
          if (typed.Code !== 200 || !Array.isArray(typed.Data?.Posts))
            throw new SourceError(
              "invalid_source_payload",
              "Tencent careers API returned an invalid response",
            );
          return {
            rows: typed.Data!.Posts!,
            total: Number(typed.Data!.Count ?? typed.Data!.Posts!.length),
          };
        },
      },
    );
    return this.buildPagedBatch(source, context, fetched, (job) => {
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
    });
  }

  private async fetchJd(
    source: JobMarketSource,
    context: { now: Date; maxItems: number },
    signal: AbortSignal,
  ) {
    const fetched = await this.fetchPagedPages<Record<string, any>>(
      source,
      context,
      signal,
      {
        pageSize: Math.min(50, context.maxItems),
        request: ({ index, pageSize }) => ({
          url: new URL("/api/wx/position/page?type=present", source.baseUrl)
            .href,
          init: {
            accept: ["application/json"],
            method: "POST",
            body: JSON.stringify({
              pageSize,
              pageIndex: index,
              parameter: {
                positionName: "",
                planIdList: [],
                jobDirectionCodeList: [],
                workCityCodeList: [],
                positionDeptList: [],
              },
            }),
            headers: { "Content-Type": "application/json" },
          },
        }),
        validate: (payload) => {
          const typed = payload as {
            success?: boolean;
            body?: { totalNumber?: number; items?: Array<Record<string, any>> };
          };
          if (!typed.success || !Array.isArray(typed.body?.items))
            throw new SourceError(
              "invalid_source_payload",
              "JD careers API returned an invalid response",
            );
          return {
            rows: typed.body!.items!,
            total: Number(typed.body!.totalNumber ?? typed.body!.items!.length),
          };
        },
      },
    );
    return this.buildPagedBatch(source, context, fetched, (job) => {
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
    });
  }
}
