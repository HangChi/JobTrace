import type { SecureSourceFetch, SourceAdapter } from "../../application/ports";
import type { JobMarketSource } from "../../domain/entities";
import { fetchJson, normalizeItems } from "./shared";

export class SmartRecruitersAdapter implements SourceAdapter {
  readonly kind = "smartrecruiters" as const;
  constructor(private readonly fetcher: SecureSourceFetch) {}
  async fetch(
    source: JobMarketSource,
    context: { runId: string; now: Date; maxItems: number },
    signal: AbortSignal,
  ) {
    const rows: Array<Record<string, any>> = [];
    let totalFound = 0;
    const itemLimit = Math.min(context.maxItems, 100);
    const pageSize = itemLimit;
    do {
      const url = new URL(
        `/v1/companies/${encodeURIComponent(source.externalKey)}/postings`,
        source.baseUrl,
      );
      url.searchParams.set("limit", String(pageSize));
      url.searchParams.set("offset", String(rows.length));
      if (source.countryCodes.length === 1)
        url.searchParams.set("country", source.countryCodes[0]);
      const response = await fetchJson(this.fetcher, source, url.href, signal);
      const body = (await response.json()) as {
        content?: Array<Record<string, any>>;
        totalFound?: number;
      };
      const page = body.content ?? [];
      totalFound = body.totalFound ?? page.length;
      rows.push(...page.slice(0, itemLimit - rows.length));
      if (!page.length) break;
    } while (rows.length < Math.min(totalFound, itemLimit));
    const normalized = normalizeItems(
      source,
      rows.map((job) => ({
        id: job.id,
        title: job.name,
        campaign: "中国区在招岗位",
        locations: job.location
          ? [job.location.city, job.location.region, job.location.country]
              .filter(Boolean)
              .join(", ")
          : [],
        recruitmentType: job.typeOfEmployment?.label,
        detailUrl: `https://jobs.smartrecruiters.com/${encodeURIComponent(source.externalKey)}/${encodeURIComponent(String(job.id))}`,
        applyUrl: `https://jobs.smartrecruiters.com/${encodeURIComponent(source.externalKey)}/${encodeURIComponent(String(job.id))}`,
        publishedAt: job.releasedDate,
        closed: job.active === false,
      })),
    );
    return {
      completeness:
        totalFound > rows.length ? ("partial" as const) : ("complete" as const),
      sourceMetadata: { fetchedAt: context.now },
      ...normalized,
    };
  }
}
