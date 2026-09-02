import { test, expect } from "@playwright/test";
import { synchronizeSource } from "@/modules/job-market/application/synchronize-source";
import type {
  JobMarketRepository,
  SourceAdapter,
  SyncRepository,
} from "@/modules/job-market/application/ports";
import type { JobMarketSource } from "@/modules/job-market/domain/entities";

test("job-market logs retain correlation ids and redact source secrets and payloads", async () => {
  const source: JobMarketSource = {
    id: "11111111-1111-4111-8111-111111111111",
    companyId: "22222222-2222-4222-8222-222222222222",
    companyName: "Logging Fixture",
    adapter: "greenhouse",
    externalKey: "private-contact@example.test",
    baseUrl: "https://user:secret@jobs.example.com/private?token=hidden",
    allowedHosts: ["jobs.example.com"],
    countryCodes: [],
    isOfficial: true,
    accessBasis: "authorized",
    status: "active",
    syncIntervalMinutes: 360,
    consecutiveFailures: 0,
    etag: null,
    lastModified: null,
  };
  const syncRepository = {
    beginRun: async () => "run-safe-id",
    completeRun: async () => undefined,
    markSourceFailure: async () => undefined,
  } as unknown as SyncRepository;
  const adapter = {
    kind: "greenhouse",
    fetch: async () => {
      throw new Error(
        'payload={"email":"private-contact@example.test"} https://user:secret@jobs.example.com',
      );
    },
  } as SourceAdapter;
  const output: string[] = [];
  const original = console.error;
  console.error = (value) => output.push(String(value));
  try {
    await synchronizeSource({
      source,
      trigger: "scheduled",
      requestId: "request-safe-id",
      workerId: "worker-safe-id",
      adapter,
      syncRepository,
      jobRepository: {} as JobMarketRepository,
    });
  } finally {
    console.error = original;
  }
  expect(output).toHaveLength(1);
  expect(JSON.parse(output[0])).toMatchObject({
    operation: "job_market_sync_failed",
    requestId: "request-safe-id",
    runId: "run-safe-id",
    sourceId: source.id,
  });
  expect(output[0]).not.toMatch(
    /private-contact|user:secret|token=hidden|payload=|jobs\.example/i,
  );
});
