import { SourceError } from "../../application/source-errors";
import type { SecureSourceFetch, SourceAdapter } from "../../application/ports";
import type { JobMarketSource } from "../../domain/entities";
import { normalizeItems } from "./shared";

type BeisenJob = {
  Id?: unknown;
  JobAdId?: unknown;
  JobAdName?: unknown;
  LocNames?: unknown;
  Category?: unknown;
  Kind?: unknown;
  Duty?: unknown;
  Require?: unknown;
  Degree?: unknown;
  PostDate?: unknown;
  EndTime?: unknown;
  Status?: unknown;
};

export class BeisenAdapter implements SourceAdapter {
  readonly kind = "beisen" as const;
  constructor(private readonly fetcher: SecureSourceFetch) {}

  async fetch(
    source: JobMarketSource,
    context: { runId: string; now: Date; maxItems: number },
    signal: AbortSignal,
  ) {
    const pageSize = Math.min(50, context.maxItems);
    const rows: BeisenJob[] = [];
    let total = 0;
    while (rows.length < context.maxItems) {
      const response = await this.fetcher(
        new URL("/api/Jobad/GetJobAdPageList", source.baseUrl).href,
        {
          allowedHosts: source.allowedHosts,
          signal,
          accept: ["application/json"],
          method: "POST",
          body: JSON.stringify({
            PageIndex: Math.floor(rows.length / pageSize),
            PageSize: pageSize,
            KeyWords: "",
            SpecialType: 0,
            PortalId: "",
            DisplayFields: ["Category", "Kind", "LocId", "PostDate", "Degree"],
          }),
          headers: {
            "Content-Type": "application/json",
            Origin: new URL(source.baseUrl).origin,
            Referer: source.baseUrl,
          },
        },
      );
      const payload = (await response.json()) as {
        Code?: number;
        Message?: string;
        Count?: number;
        Data?: BeisenJob[];
      };
      if (payload.Code !== 200 || !Array.isArray(payload.Data))
        throw new SourceError(
          "invalid_source_payload",
          `Beisen jobs API returned an invalid response${payload.Message ? `: ${payload.Message}` : ""}`,
        );
      total = Number(payload.Count ?? payload.Data.length);
      rows.push(...payload.Data.slice(0, context.maxItems - rows.length));
      if (!payload.Data.length || rows.length >= total) break;
    }
    const listingUrl = new URL("/jobs", source.baseUrl).href;
    return {
      completeness:
        rows.length < total ? ("partial" as const) : ("complete" as const),
      sourceMetadata: { fetchedAt: context.now },
      ...normalizeItems(
        source,
        rows.map((job) => ({
          id: job.Id ?? job.JobAdId,
          title: job.JobAdName,
          locations: job.LocNames,
          campaign: job.Category,
          recruitmentType: job.Category ?? job.Kind,
          education: job.Degree,
          description: [job.Duty, job.Require]
            .filter((value): value is string => typeof value === "string")
            .join("\n\n"),
          detailUrl: listingUrl,
          applyUrl: listingUrl,
          publishedAt: job.PostDate,
          validThrough:
            job.EndTime === "0001-01-01T00:00:00" ? null : job.EndTime,
          closed: job.Status === 0,
        })),
      ),
    };
  }
}
