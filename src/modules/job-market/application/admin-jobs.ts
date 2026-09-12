// 进程内 admin 长任务注册表：面向单实例部署的轻量任务化方案。
// 不持久化——进程重启后运行中的任务即丢失，任务本身可安全重跑。
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

// 服务内部用 reporter 上报进度；快照对象整体替换，轮询方拿到的是不可变快照。
export type AdminJobReporter = (progress: {
  phase?: string;
  current?: number;
  total?: number | null;
  message?: string | null;
}) => void;

type AdminJobInternal = { snapshot: AdminJobSnapshot };

const registry = new Map<string, AdminJobInternal>();
const RETAINED_FINISHED_MS = 30 * 60_000;
const MAX_TRACKED_JOBS = 50;

export class AdminJobConflictError extends Error {
  constructor(kind: AdminJobKind) {
    super(`同类任务正在运行：${kind}`);
    this.name = "AdminJobConflictError";
  }
}

export function startAdminJob(
  kind: AdminJobKind,
  run: (report: AdminJobReporter) => Promise<unknown>,
): string {
  for (const job of registry.values())
    if (job.snapshot.kind === kind && job.snapshot.status === "running")
      throw new AdminJobConflictError(kind);
  pruneAdminJobs();
  const id = crypto.randomUUID();
  const job: AdminJobInternal = {
    snapshot: {
      id,
      kind,
      status: "running",
      startedAt: new Date().toISOString(),
      finishedAt: null,
      progress: { phase: "启动中", current: 0, total: null, message: null },
      result: null,
      error: null,
    },
  };
  registry.set(id, job);
  const report: AdminJobReporter = (progress) => {
    if (job.snapshot.status !== "running") return;
    job.snapshot = {
      ...job.snapshot,
      progress: { ...job.snapshot.progress, ...progress },
    };
  };
  void run(report)
    .then((result) => {
      job.snapshot = {
        ...job.snapshot,
        status: "succeeded",
        result,
        finishedAt: new Date().toISOString(),
      };
    })
    .catch((error: unknown) => {
      job.snapshot = {
        ...job.snapshot,
        status: "failed",
        error:
          error instanceof Error
            ? error.message
            : JSON.stringify(error ?? null),
        finishedAt: new Date().toISOString(),
      };
    });
  return id;
}

export function getAdminJob(id: string): AdminJobSnapshot | null {
  return registry.get(id)?.snapshot ?? null;
}

export function pruneAdminJobs(now = Date.now()): void {
  for (const [id, job] of registry) {
    const finishedAt = Date.parse(job.snapshot.finishedAt ?? "");
    if (
      job.snapshot.status !== "running" &&
      Number.isFinite(finishedAt) &&
      now - finishedAt > RETAINED_FINISHED_MS
    )
      registry.delete(id);
  }
  if (registry.size <= MAX_TRACKED_JOBS) return;
  const removable = [...registry.values()]
    .filter((job) => job.snapshot.status !== "running")
    .sort((left, right) =>
      left.snapshot.startedAt.localeCompare(right.snapshot.startedAt),
    )
    .slice(0, registry.size - MAX_TRACKED_JOBS);
  for (const job of removable) registry.delete(job.snapshot.id);
}

export function resetAdminJobsForTesting(): void {
  registry.clear();
}
