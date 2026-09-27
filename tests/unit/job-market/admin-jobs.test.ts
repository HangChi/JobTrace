import { describe, expect, it, vi } from "vitest";
import {
  AdminJobConflictError,
  createAdminJobManager,
  type AdminJobProgress,
  type AdminJobSnapshot,
  type AdminJobStore,
} from "@/modules/job-market/application/admin-jobs";

class MemoryAdminJobStore implements AdminJobStore {
  jobs = new Map<
    string,
    { snapshot: AdminJobSnapshot; leaseExpiresAt: Date | null }
  >();

  async claim(job: AdminJobSnapshot, leaseExpiresAt: Date, now: Date) {
    for (const value of this.jobs.values()) {
      if (
        value.snapshot.kind === job.kind &&
        value.snapshot.status === "running"
      ) {
        if (value.leaseExpiresAt && value.leaseExpiresAt <= now) {
          value.snapshot = {
            ...value.snapshot,
            status: "failed",
            finishedAt: now.toISOString(),
            error: "任务执行进程已中断，请重新运行。",
          };
          value.leaseExpiresAt = null;
        } else return false;
      }
    }
    this.jobs.set(job.id, { snapshot: job, leaseExpiresAt });
    return true;
  }

  async report(
    id: string,
    progress: Partial<AdminJobProgress>,
    leaseExpiresAt: Date,
  ) {
    const job = this.jobs.get(id);
    if (!job || job.snapshot.status !== "running") return;
    job.snapshot = {
      ...job.snapshot,
      progress: { ...job.snapshot.progress, ...progress },
    };
    job.leaseExpiresAt = leaseExpiresAt;
  }

  async finish(
    id: string,
    outcome:
      | { status: "succeeded"; result: unknown }
      | { status: "failed"; error: string },
    now: Date,
  ) {
    const job = this.jobs.get(id);
    if (!job || job.snapshot.status !== "running") return;
    job.snapshot = {
      ...job.snapshot,
      ...outcome,
      finishedAt: now.toISOString(),
    };
    job.leaseExpiresAt = null;
  }

  async get(id: string, now: Date) {
    const job = this.jobs.get(id);
    if (
      job?.snapshot.status === "running" &&
      job.leaseExpiresAt &&
      job.leaseExpiresAt <= now
    ) {
      job.snapshot = {
        ...job.snapshot,
        status: "failed",
        finishedAt: now.toISOString(),
        error: "任务执行进程已中断，请重新运行。",
      };
      job.leaseExpiresAt = null;
    }
    return job?.snapshot ?? null;
  }

  async prune(finishedBefore: Date, maxFinished: number) {
    const finished = [...this.jobs.values()]
      .filter((job) => job.snapshot.status !== "running")
      .sort((left, right) =>
        right.snapshot.startedAt.localeCompare(left.snapshot.startedAt),
      );
    for (const job of finished) {
      if (
        new Date(job.snapshot.finishedAt!).getTime() < finishedBefore.getTime()
      )
        this.jobs.delete(job.snapshot.id);
    }
    for (const job of finished.slice(maxFinished))
      this.jobs.delete(job.snapshot.id);
  }
}

describe("admin job manager", () => {
  it("persists success with immutable progress snapshots", async () => {
    const manager = createAdminJobManager(new MemoryAdminJobStore());
    const id = await manager.start("ats_site_scan", async (report) => {
      report({ phase: "扫描", current: 1, total: 3, message: "query-1" });
      return { hits: 2 };
    });
    await vi.waitFor(async () =>
      expect((await manager.get(id))?.status).toBe("succeeded"),
    );
    const job = (await manager.get(id))!;
    expect(job.result).toEqual({ hits: 2 });
    expect(job.progress).toEqual({
      phase: "扫描",
      current: 1,
      total: 3,
      message: "query-1",
    });
  });

  it("captures run failures with the error message", async () => {
    const manager = createAdminJobManager(new MemoryAdminJobStore());
    const id = await manager.start("company_research", async () => {
      throw new Error("engine_blocked");
    });
    await vi.waitFor(async () =>
      expect((await manager.get(id))?.status).toBe("failed"),
    );
    expect((await manager.get(id))?.error).toBe("engine_blocked");
  });

  it("coordinates two manager instances through the shared store", async () => {
    const store = new MemoryAdminJobStore();
    const firstManager = createAdminJobManager(store);
    const secondManager = createAdminJobManager(store);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const first = await firstManager.start("wechat_collect", () => gate);
    await expect(
      secondManager.start("wechat_collect", async () => null),
    ).rejects.toBeInstanceOf(AdminJobConflictError);
    expect((await secondManager.get(first))?.status).toBe("running");
    release();
    await vi.waitFor(async () =>
      expect((await secondManager.get(first))?.status).toBe("succeeded"),
    );
  });

  it("expires an interrupted process lease and allows a retry", async () => {
    const store = new MemoryAdminJobStore();
    const options = { leaseMs: 5, heartbeatMs: 60_000 };
    const firstManager = createAdminJobManager(store, options);
    const secondManager = createAdminJobManager(store, options);
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const first = await firstManager.start("source_discovery", () => firstGate);
    await new Promise((resolve) => setTimeout(resolve, 10));
    const second = await secondManager.start(
      "source_discovery",
      async () => "retried",
    );
    expect((await secondManager.get(first))?.status).toBe("failed");
    await vi.waitFor(async () =>
      expect((await secondManager.get(second))?.status).toBe("succeeded"),
    );
    releaseFirst();
  });

  it("prunes finished jobs after the retention window", async () => {
    const manager = createAdminJobManager(new MemoryAdminJobStore());
    const id = await manager.start("catalog_bootstrap", async () => 1);
    await vi.waitFor(async () =>
      expect((await manager.get(id))?.status).toBe("succeeded"),
    );
    await manager.prune(new Date(Date.now() + 31 * 60_000));
    expect(await manager.get(id)).toBeNull();
  });
});
