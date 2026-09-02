import { SourceError } from "../../application/source-errors";
import type { SecureSourceFetch, SourceAdapter } from "../../application/ports";
import type { JobMarketSource } from "../../domain/entities";
import { normalizeItems } from "./shared";

function parseExternalKey(value: string) {
  const [tenant, site, locale = "en-US"] = value.split("|");
  if (!tenant || !site || !/^[A-Za-z0-9_-]+$/.test(tenant + site))
    throw new SourceError(
      "invalid_source_payload",
      "Workday source key must use tenant|site|optional-locale",
    );
  return { tenant, site, locale };
}

type WorkdayJob = {
  title?: unknown;
  externalPath?: unknown;
  locationsText?: unknown;
  postedOn?: unknown;
  bulletFields?: unknown;
};

export class WorkdayAdapter implements SourceAdapter {
  readonly kind = "workday" as const;
  constructor(private readonly fetcher: SecureSourceFetch) {}

  async fetch(
    source: JobMarketSource,
    context: { runId: string; now: Date; maxItems: number },
    signal: AbortSignal,
  ) {
    const { tenant, site, locale } = parseExternalKey(source.externalKey);
    const pageSize = Math.min(20, context.maxItems);
    const rows: WorkdayJob[] = [];
    let total = 0;
    while (rows.length < context.maxItems) {
      const endpoint = new URL(
        `/wday/cxs/${encodeURIComponent(tenant)}/${encodeURIComponent(site)}/jobs`,
        source.baseUrl,
      );
      const response = await this.fetcher(endpoint.href, {
        allowedHosts: source.allowedHosts,
        signal,
        accept: ["application/json"],
        method: "POST",
        body: JSON.stringify({
          appliedFacets: {},
          limit: pageSize,
          offset: rows.length,
          searchText: "China",
        }),
        headers: { "Content-Type": "application/json" },
      });
      const payload = (await response.json()) as {
        total?: number;
        jobPostings?: WorkdayJob[];
      };
      if (!Array.isArray(payload.jobPostings))
        throw new SourceError(
          "invalid_source_payload",
          "Workday jobs API returned an invalid response",
        );
      total = Number(payload.total ?? payload.jobPostings.length);
      rows.push(
        ...payload.jobPostings.slice(0, context.maxItems - rows.length),
      );
      if (!payload.jobPostings.length || rows.length >= total) break;
    }
    const origin = new URL(source.baseUrl).origin;
    return {
      completeness:
        rows.length < total ? ("partial" as const) : ("complete" as const),
      sourceMetadata: { fetchedAt: context.now },
      ...normalizeItems(
        source,
        rows
          .filter((job) =>
            /china|beijing|shanghai|shenzhen|guangzhou|中国|北京|上海|深圳|广州/i.test(
              `${String(job.title ?? "")} ${String(job.locationsText ?? "")}`,
            ),
          )
          .map((job) => {
            const externalPath =
              typeof job.externalPath === "string" ? job.externalPath : "";
            const detailUrl = externalPath
              ? `${origin}/${locale}/${site}${externalPath.startsWith("/") ? externalPath : `/${externalPath}`}`
              : null;
            return {
              id: externalPath,
              title: job.title,
              locations: job.locationsText,
              description: Array.isArray(job.bulletFields)
                ? job.bulletFields.join(" · ")
                : job.bulletFields,
              detailUrl,
              applyUrl: detailUrl,
            };
          }),
      ),
    };
  }
}
