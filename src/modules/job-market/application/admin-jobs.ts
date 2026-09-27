import { PostgresAdminJobStore } from "../infrastructure/postgres-admin-job-store";

export type AdminJobKind =
  | "wechat_collect"
  | "ats_site_scan"
  | "company_research"
  | "source_discovery"
  | "catalog_bootstrap";

export type AdminJobProgress = {
  phase: string;
  current: number;
  total: number | null;
  message: string | null;
};

export type AdminJobSnapshot = {
  id: string;
  kind: AdminJobKind;
  status: "running" | "succeeded" | "failed";
  startedAt: string;
  finishedAt: string | null;
  progress: AdminJobProgress;
  result: unknown;
  error: string | null;
};

export type AdminJobReporter = (progress: Partial<AdminJobProgress>) => void;

export interface AdminJobStore {
  claim(
    job: AdminJobSnapshot,
    leaseExpiresAt: Date,
    now: Date,
  ): Promise<boolean>;
  report(
    id: string,
    progress: Partial<AdminJobProgress>,
    leaseExpiresAt: Date,
  ): Promise<void>;
  finish(
    id: string,
    outcome:
      | { status: "succeeded"; result: unknown }
      | { status: "failed"; error: string },
    now: Date,
  ): Promise<void>;
  get(id: string, now: Date): Promise<AdminJobSnapshot | null>;
  prune(finishedBefore: Date, maxFinished: number): Promise<void>;
}

const RETAINED_FINISHED_MS = 30 * 60_000;
const MAX_FINISHED_JOBS = 50;
const LEASE_MS = 2 * 60_000;
const HEARTBEAT_MS = 30_000;

export class AdminJobConflictError extends Error {
  constructor(kind: AdminJobKind) {
    super(`同类任务正在运行：${kind}`);
    this.name = "AdminJobConflictError";
  }
}

export function createAdminJobManager(
  store: AdminJobStore,
  options: { leaseMs?: number; heartbeatMs?: number } = {},
) {
  const leaseMs = options.leaseMs ?? LEASE_MS;
  const heartbeatMs = options.heartbeatMs ?? HEARTBEAT_MS;

  async function prune(now = new Date()) {
    await store.prune(
      new Date(now.getTime() - RETAINED_FINISHED_MS),
      MAX_FINISHED_JOBS,
    );
  }

  async function start(
    kind: AdminJobKind,
    run: (report: AdminJobReporter) => Promise<unknown>,
  ): Promise<string> {
    const now = new Date();
    await prune(now);
    const id = crypto.randomUUID();
    const job: AdminJobSnapshot = {
      id,
      kind,
      status: "running",
      startedAt: now.toISOString(),
      finishedAt: null,
      progress: { phase: "启动中", current: 0, total: null, message: null },
      result: null,
      error: null,
    };
    if (!(await store.claim(job, new Date(now.getTime() + leaseMs), now)))
      throw new AdminJobConflictError(kind);

    let writes = Promise.resolve();
    const enqueueReport = (progress: Partial<AdminJobProgress>) => {
      writes = writes
        .then(() => store.report(id, progress, new Date(Date.now() + leaseMs)))
        .catch(() => undefined);
    };
    const heartbeat = setInterval(() => enqueueReport({}), heartbeatMs);
    heartbeat.unref?.();

    void run(enqueueReport)
      .then(async (result) => {
        clearInterval(heartbeat);
        await writes;
        await store.finish(id, { status: "succeeded", result }, new Date());
      })
      .catch(async (error: unknown) => {
        clearInterval(heartbeat);
        await writes;
        await store.finish(
          id,
          {
            status: "failed",
            error:
              error instanceof Error
                ? error.message
                : JSON.stringify(error ?? null),
          },
          new Date(),
        );
      })
      .catch(() => undefined);
    return id;
  }

  return {
    start,
    get: (id: string) => store.get(id, new Date()),
    prune,
  };
}

let productionManager: ReturnType<typeof createAdminJobManager> | undefined;

function manager() {
  productionManager ??= createAdminJobManager(new PostgresAdminJobStore());
  return productionManager;
}

export function startAdminJob(
  kind: AdminJobKind,
  run: (report: AdminJobReporter) => Promise<unknown>,
) {
  return manager().start(kind, run);
}

export function getAdminJob(id: string) {
  return manager().get(id);
}

export function pruneAdminJobs(now?: Date) {
  return manager().prune(now);
}
