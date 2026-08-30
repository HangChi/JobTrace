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
    const url = new URL(
      `/v1/companies/${encodeURIComponent(source.externalKey)}/postings`,
      source.baseUrl,
    );
    url.searchParams.set("limit", String(Math.min(context.maxItems, 100)));
    const response = await fetchJson(this.fetcher, source, url.href, signal);
    const body = (await response.json()) as {
      content?: Array<Record<string, any>>;
      totalFound?: number;
    };
    const rows = body.content ?? [];
    const normalized = normalizeItems(
      source,
      rows.map((job) => ({
        id: job.id,
        title: job.name,
        locations: job.location
          ? [job.location.city, job.location.region, job.location.country]
              .filter(Boolean)
              .join(", ")
          : [],
        recruitmentType: job.typeOfEmployment?.label,
        detailUrl: job.ref,
        applyUrl: job.ref,
        publishedAt: job.releasedDate,
        closed: job.active === false,
      })),
    );
    return {
      completeness:
        (body.totalFound ?? rows.length) > rows.length
          ? ("partial" as const)
          : ("complete" as const),
      sourceMetadata: { fetchedAt: context.now },
      ...normalized,
    };
  }
}
