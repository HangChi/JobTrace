import type { SecureSourceFetch, SourceAdapter } from "../../application/ports";
import type { JobMarketSource } from "../../domain/entities";
import { fetchJson, normalizeItems } from "./shared";

export class GreenhouseAdapter implements SourceAdapter {
  readonly kind = "greenhouse" as const;
  constructor(private readonly fetcher: SecureSourceFetch) {}
  async fetch(
    source: JobMarketSource,
    context: { runId: string; now: Date; maxItems: number },
    signal: AbortSignal,
  ) {
    const url = new URL(
      `/v1/boards/${encodeURIComponent(source.externalKey)}/jobs`,
      source.baseUrl,
    );
    url.searchParams.set("content", "true");
    const response = await fetchJson(this.fetcher, source, url.href, signal);
    const body = (await response.json()) as {
      jobs?: Array<Record<string, unknown>>;
    };
    const items = (body.jobs ?? []).slice(0, context.maxItems).map((job) => ({
      id: job.id,
      title: job.title,
      locations: job.location,
      description: job.content,
      detailUrl: job.absolute_url,
      applyUrl: job.absolute_url,
      publishedAt: job.updated_at,
    }));
    const normalized = normalizeItems(source, items);
    return {
      completeness:
        (body.jobs?.length ?? 0) > context.maxItems
          ? ("partial" as const)
          : ("complete" as const),
      sourceMetadata: {
        fetchedAt: context.now,
        etag: response.headers.get("etag") ?? undefined,
        lastModified: response.headers.get("last-modified") ?? undefined,
      },
      ...normalized,
    };
  }
}
