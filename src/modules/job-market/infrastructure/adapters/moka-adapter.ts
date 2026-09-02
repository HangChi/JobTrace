import { SourceError } from "../../application/source-errors";
import type { SecureSourceFetch, SourceAdapter } from "../../application/ports";
import type { JobMarketSource } from "../../domain/entities";
import { fetchJson, normalizeItems } from "./shared";

type MokaLocation = {
  province?: unknown;
  city?: unknown;
  area?: unknown;
  country?: unknown;
  address?: unknown;
};

type MokaJob = {
  id?: unknown;
  title?: unknown;
  status?: unknown;
  description?: unknown;
  commitment?: unknown;
  education?: unknown;
  publishedAt?: unknown;
  updatedAt?: unknown;
  locations?: unknown;
};

function parseExternalKey(value: string) {
  const [orgId, mode = "social", siteId = ""] = value.split("|");
  if (!orgId || !["social", "campus"].includes(mode))
    throw new SourceError(
      "invalid_source_payload",
      "Moka source key must use orgId|social-or-campus|optional-siteId",
    );
  return { orgId, mode, siteId };
}

function locationName(value: MokaLocation) {
  const parts = [value.province, value.city, value.area]
    .filter((part): part is string => typeof part === "string" && Boolean(part))
    .map((part) => part.normalize("NFKC").trim());
  return (
    [...new Set(parts)].join(" · ") ||
    (typeof value.address === "string" ? value.address : null)
  );
}

function locations(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item): item is MokaLocation => Boolean(item) && typeof item === "object",
    )
    .filter(
      (item) =>
        typeof item.country !== "string" ||
        /^(?:中国|China|CN)$/iu.test(item.country.trim()),
    )
    .map(locationName)
    .filter((item): item is string => Boolean(item));
}

function applicationUrl(
  orgId: string,
  mode: string,
  siteId: string,
  jobId: unknown,
) {
  if (typeof jobId !== "string" || !jobId) return null;
  const portal = mode === "campus" ? "campus_apply" : "apply";
  const sitePath = siteId ? `/${encodeURIComponent(siteId)}` : "";
  return `https://app.mokahr.com/${portal}/${encodeURIComponent(orgId)}${sitePath}#/job/${encodeURIComponent(jobId)}/apply`;
}

export class MokaAdapter implements SourceAdapter {
  readonly kind = "moka" as const;
  constructor(private readonly fetcher: SecureSourceFetch) {}

  async fetch(
    source: JobMarketSource,
    context: { runId: string; now: Date; maxItems: number },
    signal: AbortSignal,
  ) {
    const { orgId, mode, siteId } = parseExternalKey(source.externalKey);
    const itemLimit = Math.min(100, context.maxItems);
    const pageSize = Math.min(50, itemLimit);
    const rows: MokaJob[] = [];
    let total = 0;

    while (rows.length < itemLimit) {
      const url = new URL(
        `/api-platform/v1/jobs/${encodeURIComponent(orgId)}`,
        source.baseUrl,
      );
      url.searchParams.set("mode", mode);
      url.searchParams.set("status", "open");
      url.searchParams.set("limit", String(pageSize));
      url.searchParams.set("offset", String(rows.length));
      if (siteId) url.searchParams.set("siteId", siteId);

      const response = await fetchJson(this.fetcher, source, url.href, signal);
      const body = (await response.json()) as {
        code?: number;
        msg?: string;
        total?: number;
        jobs?: MokaJob[];
      };
      if (body.code !== 0 || !Array.isArray(body.jobs))
        throw new SourceError(
          "invalid_source_payload",
          `Moka jobs API returned an invalid response${body.msg ? `: ${body.msg}` : ""}`,
        );
      const page = body.jobs;
      total = typeof body.total === "number" ? body.total : page.length;
      rows.push(...page.slice(0, itemLimit - rows.length));
      if (!page.length || rows.length >= total) break;
    }

    const normalized = normalizeItems(
      source,
      rows.map((job) => {
        const applyUrl = applicationUrl(orgId, mode, siteId, job.id);
        return {
          id: job.id,
          title: job.title,
          locations: locations(job.locations),
          campaign: mode === "campus" ? "校园招聘" : "社会招聘",
          recruitmentType: mode === "campus" ? "校园招聘" : job.commitment,
          education: job.education,
          description: job.description,
          detailUrl: applyUrl,
          applyUrl,
          publishedAt: job.publishedAt ?? job.updatedAt,
          closed: job.status === "closed",
          preserveUrlHash: true,
        };
      }),
    );
    return {
      completeness:
        rows.length < total ? ("partial" as const) : ("complete" as const),
      sourceMetadata: { fetchedAt: context.now },
      ...normalized,
    };
  }
}
