import { logServerError, logServerEvent } from "@/shared/observability/logger";
import type {
  JobMarketRepository,
  SourceAdapter,
  SyncClaim,
  SyncRepository,
} from "./ports";
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
  claim: SyncClaim;
  requestId: string;
  adapter: SourceAdapter;
  syncRepository: SyncRepository;
  jobRepository: JobMarketRepository;
  now?: Date;
  maxItems?: number;
}) {
  const now = dependencies.now ?? new Date();
  const { source, runId } = dependencies.claim;
  const controller = new AbortController();
  try {
    const batch = await dependencies.adapter.fetch(
      source,
      { runId, now, maxItems: dependencies.maxItems ?? 10_000 },
      controller.signal,
    );
    const status =
      batch.completeness === "partial" || batch.rejected.length > 0
        ? "partial"
        : "succeeded";
    const result = await dependencies.jobRepository.completeBatch(
      dependencies.claim,
      batch,
      now,
      status,
    );
    logServerEvent("job_market_sync_completed", {
      requestId: dependencies.requestId,
      runId,
      sourceId: source.id,
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
    const minutes = Math.min(
      360,
      5 * 2 ** Math.min(6, source.consecutiveFailures),
    );
    await dependencies.syncRepository.completeFailure(
      dependencies.claim,
      now,
      new Date(now.getTime() + minutes * 60_000),
      result,
    );
    logServerError("job_market_sync_failed", error, {
      requestId: dependencies.requestId,
      runId,
      sourceId: source.id,
      code: safe.code,
    });
    return { runId, status: "failed" as const, result };
  }
}
