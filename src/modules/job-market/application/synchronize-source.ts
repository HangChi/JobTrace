import { logServerError, logServerEvent } from "@/shared/observability/logger";
import type {
  JobMarketRepository,
  SourceAdapter,
  SyncRepository,
} from "./ports";
import type { JobMarketSource, SyncTrigger } from "../domain/entities";
import { safeSourceError } from "./source-errors";

const emptyResult = () => ({
  discovered: 0,
  created: 0,
  updated: 0,
  stale: 0,
  closed: 0,
  rejected: 0,
});

export async function synchronizeSource(dependencies: {
  source: JobMarketSource;
  trigger: SyncTrigger;
  requestId: string;
  workerId: string;
  adapter: SourceAdapter;
  syncRepository: SyncRepository;
  jobRepository: JobMarketRepository;
  now?: Date;
  maxItems?: number;
}) {
  const now = dependencies.now ?? new Date();
  const runId = await dependencies.syncRepository.beginRun(
    dependencies.source.id,
    dependencies.trigger,
    dependencies.workerId,
    dependencies.requestId,
  );
  const controller = new AbortController();
  try {
    const batch = await dependencies.adapter.fetch(
      dependencies.source,
      { runId, now, maxItems: dependencies.maxItems ?? 10_000 },
      controller.signal,
    );
    const result = await dependencies.jobRepository.applyBatch(
      dependencies.source,
      runId,
      batch,
      now,
    );
    const status =
      batch.completeness === "partial" || result.rejected > 0
        ? "partial"
        : "succeeded";
    await dependencies.syncRepository.completeRun(runId, status, result);
    await dependencies.syncRepository.markSourceSuccess(
      dependencies.source.id,
      now,
      dependencies.source.syncIntervalMinutes,
      batch.sourceMetadata,
    );
    logServerEvent("job_market_sync_completed", {
      requestId: dependencies.requestId,
      runId,
      sourceId: dependencies.source.id,
      status,
      ...result,
    });
    return { runId, status, result };
  } catch (error) {
    const safe = safeSourceError(error);
    const result = {
      ...emptyResult(),
      errorCode: safe.code,
      errorSummary: safe.summary,
    };
    await dependencies.syncRepository.completeRun(runId, "failed", result);
    const minutes = Math.min(
      360,
      5 * 2 ** Math.min(6, dependencies.source.consecutiveFailures),
    );
    await dependencies.syncRepository.markSourceFailure(
      dependencies.source.id,
      now,
      new Date(now.getTime() + minutes * 60_000),
    );
    logServerError("job_market_sync_failed", error, {
      requestId: dependencies.requestId,
      runId,
      sourceId: dependencies.source.id,
      code: safe.code,
    });
    return { runId, status: "failed" as const, result };
  }
}
