import { load } from "cheerio";
import { SourceError } from "../../application/source-errors";
import type { SecureSourceFetch, SourceAdapter } from "../../application/ports";
import type { JobMarketSource } from "../../domain/entities";
import { normalizeItems } from "./shared";

type FeishuJob = {
  id?: unknown;
  title?: unknown;
  description?: unknown;
  requirement?: unknown;
  city_list?: Array<{ name?: unknown }>;
  job_function?: { name?: unknown };
  recruit_type?: { name?: unknown };
  publish_time?: unknown;
};

function parseExternalKey(value: string) {
  const [host, forcedPath = ""] = value.split("|");
  if (!host || !/^[a-z0-9.-]+\.jobs\.feishu\.cn$/i.test(host))
    throw new SourceError(
      "invalid_source_payload",
      "Feishu source key must use an approved jobs.feishu.cn host",
    );
  if (forcedPath && !/^[A-Za-z0-9_/-]{1,40}$/.test(forcedPath))
    throw new SourceError(
      "invalid_source_payload",
      "Feishu website path is invalid",
    );
  return {
    host: host.toLowerCase(),
    forcedPath: forcedPath.replace(/^\/+|\/+$/g, ""),
  };
}

function websitePath(html: string) {
  const $ = load(html);
  const text = $("#js-websiteInfo").text();
  if (!text) return "index";
  try {
    const parsed = JSON.parse(text) as { website_info?: { path?: unknown } };
    const path = parsed.website_info?.path;
    return typeof path === "string" && /^[A-Za-z0-9_/-]{1,40}$/.test(path)
      ? path
      : "index";
  } catch {
    return "index";
  }
}

function publishedAt(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value))
    return new Date(value).toISOString();
  return value;
}

export class FeishuAdapter implements SourceAdapter {
  readonly kind = "feishu" as const;
  constructor(private readonly fetcher: SecureSourceFetch) {}

  async fetch(
    source: JobMarketSource,
    context: { runId: string; now: Date; maxItems: number },
    signal: AbortSignal,
  ) {
    const { host, forcedPath } = parseExternalKey(source.externalKey);
    const origin = `https://${host}`;
    let path = forcedPath;
    if (!path) {
      const homepage = await this.fetcher(`${origin}/`, {
        allowedHosts: source.allowedHosts,
        signal,
        accept: ["text/html", "application/xhtml+xml"],
      });
      path = websitePath(await homepage.text());
    }

    const pageSize = Math.min(50, context.maxItems);
    const rows: FeishuJob[] = [];
    let total = 0;
    let lastHeaders = new Headers();
    while (rows.length < context.maxItems) {
      const response = await this.fetcher(`${origin}/api/v1/search/job/posts`, {
        allowedHosts: source.allowedHosts,
        signal,
        accept: ["application/json"],
        method: "POST",
        body: JSON.stringify({
          keyword: "",
          limit: pageSize,
          offset: rows.length,
          portal_type: 2,
          job_category_id_list: [],
          location_code_list: [],
          subject_id_list: [],
          recruitment_id_list: [],
          job_function_id_list: [],
        }),
        headers: {
          "Content-Type": "application/json",
          Origin: origin,
          Referer: `${origin}/`,
          "Portal-Channel": "office",
          "Portal-Platform": "pc",
          "website-path": path,
        },
      });
      lastHeaders = response.headers;
      const payload = (await response.json()) as {
        code?: number;
        message?: string;
        data?: { count?: number; job_post_list?: FeishuJob[] };
      };
      const page = payload.data?.job_post_list;
      if (payload.code !== 0 || !Array.isArray(page))
        throw new SourceError(
          "invalid_source_payload",
          `Feishu jobs API returned an invalid response${payload.message ? `: ${payload.message}` : ""}`,
        );
      total = Number(payload.data?.count ?? page.length);
      rows.push(...page.slice(0, context.maxItems - rows.length));
      if (!page.length || page.length < pageSize || rows.length >= total) break;
    }

    const normalized = normalizeItems(
      source,
      rows.map((job) => {
        const id = typeof job.id === "string" ? job.id : String(job.id ?? "");
        const detailUrl = id
          ? `${origin}/${path}/position/${encodeURIComponent(id)}/detail`
          : null;
        return {
          id,
          title: job.title,
          locations: (job.city_list ?? []).map((city) => city.name),
          campaign: job.recruit_type?.name,
          recruitmentType: job.recruit_type?.name,
          description: [job.description, job.requirement]
            .filter((value): value is string => typeof value === "string")
            .join("\n\n"),
          detailUrl,
          applyUrl: detailUrl,
          publishedAt: publishedAt(job.publish_time),
        };
      }),
    );
    return {
      completeness:
        rows.length < total ? ("partial" as const) : ("complete" as const),
      sourceMetadata: {
        fetchedAt: context.now,
        etag: lastHeaders.get("etag") ?? undefined,
        lastModified: lastHeaders.get("last-modified") ?? undefined,
      },
      ...normalized,
    };
  }
}
