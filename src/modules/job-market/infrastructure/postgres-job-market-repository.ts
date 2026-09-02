import { createServerDatabase } from "@/shared/database";
import type { JobMarketRepository, SyncResult } from "../application/ports";
import type {
  JobMarketSource,
  NormalizedSourceBatch,
} from "../domain/entities";

type Sql = ReturnType<typeof createServerDatabase>;

type BatchResult = {
  discovered: number;
  created: number;
  updated: number;
  stale: number;
  closed: number;
  rejected: number;
};

export class PostgresJobMarketRepository implements JobMarketRepository {
  constructor(private readonly sql: Sql = createServerDatabase()) {}

  async applyBatch(
    source: JobMarketSource,
    runId: string,
    batch: NormalizedSourceBatch,
    now: Date,
  ): Promise<SyncResult> {
    const payload = batch.jobs.map((job, ordinal) => ({
      ordinal,
      proposed_post_id: crypto.randomUUID(),
      external_job_id: job.externalJobId,
      title: job.title,
      normalized_title: job.normalizedTitle,
      description_text: job.descriptionText,
      recruitment_type: job.recruitmentType,
      target: job.target,
      education: job.education,
      source_status: job.sourceStatus,
      detail_url: job.detailUrl,
      apply_url: job.applyUrl,
      published_at: job.publishedAt?.toISOString() ?? null,
      valid_through: job.validThrough?.toISOString() ?? null,
      content_hash: job.contentHash,
      campaign_key: job.campaignKey,
      campaign_name: job.campaignName,
      batch_label: job.batchLabel,
      locations: job.locations.map((location) => ({
        normalizedKey: location.normalizedKey,
        name: location.name,
        isRemote: location.isRemote,
      })),
    }));
    const [result] = await this.sql<BatchResult[]>`
      select discovered,created,updated,stale,closed,rejected
      from public.apply_job_market_batch(
        ${source.id},${runId},${this.sql.json(payload as never)},${batch.completeness},
        ${batch.rejected.length},${now}
      )`;
    return (
      result ?? {
        discovered: 0,
        created: 0,
        updated: 0,
        stale: 0,
        closed: 0,
        rejected: batch.rejected.length,
      }
    );
  }
}
