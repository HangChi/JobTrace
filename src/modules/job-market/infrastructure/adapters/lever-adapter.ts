import type { SecureSourceFetch, SourceAdapter } from "../../application/ports";
import type { JobMarketSource } from "../../domain/entities";
import { fetchJson, normalizeItems } from "./shared";

export class LeverAdapter implements SourceAdapter {
  readonly kind = "lever" as const;
  constructor(private readonly fetcher: SecureSourceFetch) {}
  async fetch(
    source: JobMarketSource,
    context: { runId: string; now: Date; maxItems: number },
    signal: AbortSignal,
  ) {
    const url = new URL(
      `/v0/postings/${encodeURIComponent(source.externalKey)}`,
      source.baseUrl,
    );
    url.searchParams.set("mode", "json");
    const response = await fetchJson(this.fetcher, source, url.href, signal);
    const body = await response.json();
    const rows = Array.isArray(body)
      ? (body as Array<Record<string, any>>)
      : [];
    const normalized = normalizeItems(
      source,
      rows.slice(0, context.maxItems).map((job) => ({
        id: job.id,
        title: job.text,
        locations: job.categories?.location,
        recruitmentType: job.categories?.commitment,
        description: job.descriptionPlain ?? job.description,
        detailUrl: job.hostedUrl,
        applyUrl: job.applyUrl ?? job.hostedUrl,
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
