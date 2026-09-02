import type { SecureSourceFetch, SourceAdapter } from "../../application/ports";
import type { JobMarketSource } from "../../domain/entities";
import { fetchJson, normalizeItems } from "./shared";

export class AshbyAdapter implements SourceAdapter {
  readonly kind = "ashby" as const;
  constructor(private readonly fetcher: SecureSourceFetch) {}
  async fetch(
    source: JobMarketSource,
    context: { runId: string; now: Date; maxItems: number },
    signal: AbortSignal,
  ) {
    const url = new URL(
      `/posting-api/job-board/${encodeURIComponent(source.externalKey)}`,
      source.baseUrl,
    );
    const response = await fetchJson(this.fetcher, source, url.href, signal);
    const body = (await response.json()) as {
      jobs?: Array<Record<string, any>>;
    };
    const rows = body.jobs ?? [];
    const normalized = normalizeItems(
      source,
      rows.slice(0, context.maxItems).map((job) => ({
        id: job.id ?? job.jobUrl,
        title: job.title,
        locations:
          job.secondaryLocations
            ?.map((item: any) => item.location)
            .concat(job.location ?? []) ?? job.location,
        recruitmentType: job.employmentType,
        description: job.descriptionPlain ?? job.descriptionHtml,
        detailUrl: job.jobUrl,
        applyUrl: job.applyUrl ?? job.jobUrl,
        publishedAt: job.publishedAt,
        closed: job.isListed === false,
      })),
    );
    return {
      completeness:
        rows.length > context.maxItems
          ? ("partial" as const)
          : ("complete" as const),
      sourceMetadata: { fetchedAt: context.now },
      ...normalized,
    };
  }
}
