import { load } from "cheerio";
import type { SecureSourceFetch, SourceAdapter } from "../../application/ports";
import type { JobMarketSource } from "../../domain/entities";
import { normalizeItems } from "./shared";

function jobPostings(value: unknown): Array<Record<string, any>> {
  if (Array.isArray(value)) return value.flatMap(jobPostings);
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, any>;
  const graph = Array.isArray(record["@graph"])
    ? record["@graph"].flatMap(jobPostings)
    : [];
  const types = Array.isArray(record["@type"])
    ? record["@type"]
    : [record["@type"]];
  return types.includes("JobPosting") ? [record, ...graph] : graph;
}

export class SchemaOrgAdapter implements SourceAdapter {
  readonly kind = "schema_org" as const;
  constructor(private readonly fetcher: SecureSourceFetch) {}
  async fetch(
    source: JobMarketSource,
    context: { runId: string; now: Date; maxItems: number },
    signal: AbortSignal,
  ) {
    const response = await this.fetcher(source.baseUrl, {
      allowedHosts: source.allowedHosts,
      signal,
      accept: ["text/html", "application/xhtml+xml"],
    });
    const $ = load(await response.text());
    const raw: Array<Record<string, any>> = [];
    $('script[type="application/ld+json"]').each((_index, element) => {
      try {
        raw.push(...jobPostings(JSON.parse($(element).text()) as unknown));
      } catch {
        /* isolate malformed JSON-LD */
      }
    });
    const rows = raw.slice(0, context.maxItems);
    const normalized = normalizeItems(
      source,
      rows.map((job) => ({
        id: job.identifier?.value ?? job.identifier ?? job.url,
        title: job.title,
        locations:
          job.jobLocation ??
          (job.jobLocationType === "TELECOMMUTE" ? ["Remote"] : []),
        recruitmentType: job.employmentType,
        description: job.description,
        detailUrl: job.url,
        applyUrl: job.directApply === false ? null : job.url,
        publishedAt: job.datePosted,
        validThrough: job.validThrough,
      })),
    );
    return {
      completeness:
        raw.length > context.maxItems
          ? ("partial" as const)
          : ("complete" as const),
      sourceMetadata: { fetchedAt: context.now },
      ...normalized,
    };
  }
}
