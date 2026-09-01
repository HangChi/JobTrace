import { load } from "cheerio";
import { SourceError } from "../../application/source-errors";
import type { SecureSourceFetch, SourceAdapter } from "../../application/ports";
import type { JobMarketSource } from "../../domain/entities";
import { normalizeItems, type AdapterJobInput } from "./shared";

const JOB_LINK_PATTERN =
  /(?:job|jobs|position|positions|post|posts|vacancy|career|recruit|zhaopin|招聘|职位)/i;
const NON_JOB_TITLE_PATTERN =
  /^(?:职位|岗位|招聘|加入我们|查看详情|立即申请|立即投递|更多|下一页|上一页|首页)$/i;
const LOCATION_PATTERN =
  /(?:北京|上海|深圳|广州|杭州|苏州|南京|成都|武汉|西安|天津|重庆|无锡|宁波|厦门|青岛|长沙|郑州|合肥|济南|佛山|东莞|大连|沈阳|昆明|南昌|福州|珠海|惠州|常州|南通|嘉兴|绍兴|温州|全国|远程)/g;
const NEXT_PAGE_PATTERN = /^(?:下一页|下页|next|next page|›|»|>)$/i;
const MAX_PAGES_PER_SYNC = 20;

function clean(value: string | null | undefined) {
  return value?.normalize("NFKC").replace(/\s+/g, " ").trim() ?? "";
}

function candidateContainer($: ReturnType<typeof load>, element: any) {
  return $(element).closest(
    "li, tr, article, [class*='job'], [class*='Job'], [class*='position'], [class*='Position'], [class*='post'], [class*='Post']",
  );
}

export function parsePublicJobList(
  html: string,
  entryUrl: string,
  maxItems: number,
): AdapterJobInput[] {
  const $ = load(html);
  const seen = new Set<string>();
  const jobs: AdapterJobInput[] = [];
  $("a[href]").each((_index, element) => {
    if (jobs.length >= maxItems) return false;
    const href = $(element).attr("href");
    const title = clean($(element).attr("title") || $(element).text());
    if (
      !href ||
      href.startsWith("javascript:") ||
      href.startsWith("mailto:") ||
      title.length < 2 ||
      title.length > 160 ||
      NON_JOB_TITLE_PATTERN.test(title) ||
      (!JOB_LINK_PATTERN.test(href) && !JOB_LINK_PATTERN.test(title))
    )
      return;
    let detailUrl: string;
    try {
      const resolved = new URL(href, entryUrl);
      if (resolved.protocol !== "https:") return;
      detailUrl = resolved.href;
    } catch {
      return;
    }
    if (seen.has(detailUrl)) return;
    seen.add(detailUrl);
    const container = candidateContainer($, element);
    const context = clean(container.text());
    const locations = [...new Set(context.match(LOCATION_PATTERN) ?? [])];
    jobs.push({
      id: detailUrl,
      title,
      locations,
      description: context === title ? null : context,
      detailUrl,
      applyUrl: detailUrl,
    });
  });
  return jobs;
}

function findNextPage(html: string, currentUrl: string) {
  const $ = load(html);
  const candidate = $("a[href]")
    .toArray()
    .find((element) => {
      const anchor = $(element);
      return (
        anchor.attr("rel")?.split(/\s+/).includes("next") ||
        NEXT_PAGE_PATTERN.test(clean(anchor.attr("title") || anchor.text()))
      );
    });
  const href = candidate ? $(candidate).attr("href") : null;
  if (!href || href.startsWith("javascript:")) return null;
  try {
    const next = new URL(href, currentUrl);
    return next.protocol === "https:" ? next.href : null;
  } catch {
    return null;
  }
}

export async function fetchHtmlJobList(
  fetcher: SecureSourceFetch,
  source: JobMarketSource,
  context: { now: Date; maxItems: number },
  signal: AbortSignal,
) {
  const visitedPages = new Set<string>();
  const seenJobs = new Set<string>();
  const rows: AdapterJobInput[] = [];
  let pageUrl: string | null = source.baseUrl;
  while (
    pageUrl &&
    visitedPages.size < MAX_PAGES_PER_SYNC &&
    rows.length < context.maxItems
  ) {
    if (visitedPages.has(pageUrl)) break;
    visitedPages.add(pageUrl);
    const response = await fetcher(pageUrl, {
      allowedHosts: source.allowedHosts,
      signal,
      accept: ["text/html", "application/xhtml+xml"],
    });
    if (response.status < 200 || response.status >= 400)
      throw new SourceError(
        "source_unavailable",
        `Recruitment page returned HTTP ${response.status}`,
      );
    const html = await response.text();
    for (const job of parsePublicJobList(
      html,
      pageUrl,
      context.maxItems - rows.length,
    )) {
      const key = String(job.detailUrl ?? job.id ?? "");
      if (!key || seenJobs.has(key)) continue;
      seenJobs.add(key);
      rows.push(job);
    }
    pageUrl = findNextPage(html, pageUrl);
  }
  if (!rows.length)
    throw new SourceError(
      "invalid_source_payload",
      "Recruitment page did not expose recognizable public job links",
    );
  return {
    completeness: pageUrl ? ("partial" as const) : ("complete" as const),
    sourceMetadata: { fetchedAt: context.now },
    ...normalizeItems(source, rows),
  };
}

export class HtmlListAdapter implements SourceAdapter {
  readonly kind = "html_list" as const;
  constructor(private readonly fetcher: SecureSourceFetch) {}
  fetch(
    source: JobMarketSource,
    context: { runId: string; now: Date; maxItems: number },
    signal: AbortSignal,
  ) {
    return fetchHtmlJobList(this.fetcher, source, context, signal);
  }
}

export class DayeeAdapter implements SourceAdapter {
  readonly kind = "dayee" as const;
  constructor(private readonly fetcher: SecureSourceFetch) {}
  fetch(
    source: JobMarketSource,
    context: { runId: string; now: Date; maxItems: number },
    signal: AbortSignal,
  ) {
    return fetchHtmlJobList(this.fetcher, source, context, signal);
  }
}

export class Job51Adapter implements SourceAdapter {
  readonly kind = "job51" as const;
  constructor(private readonly fetcher: SecureSourceFetch) {}
  fetch(
    source: JobMarketSource,
    context: { runId: string; now: Date; maxItems: number },
    signal: AbortSignal,
  ) {
    return fetchHtmlJobList(this.fetcher, source, context, signal);
  }
}
