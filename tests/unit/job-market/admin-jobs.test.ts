import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AdminJobConflictError,
  getAdminJob,
  pruneAdminJobs,
  resetAdminJobsForTesting,
  startAdminJob,
} from "@/modules/job-market/application/admin-jobs";

afterEach(() => {
  resetAdminJobsForTesting();
});

describe("admin job registry", () => {
  it("tracks success with immutable progress snapshots", async () => {
    const id = startAdminJob("ats_site_scan", async (report) => {
      report({ phase: "扫描", current: 1, total: 3, message: "query-1" });
      return { hits: 2 };
    });
    await vi.waitFor(() => expect(getAdminJob(id)?.status).toBe("succeeded"));
    const job = getAdminJob(id)!;
    expect(job.kind).toBe("ats_site_scan");
    expect(job.result).toEqual({ hits: 2 });
    expect(job.error).toBeNull();
    expect(job.finishedAt).toBeTruthy();
    expect(job.progress).toEqual({
      phase: "扫描",
      current: 1,
      total: 3,
      message: "query-1",
    });
  });

  it("captures run failures with the error message", async () => {
    const id = startAdminJob("company_research", async () => {
      throw new Error("engine_blocked");
    });
    await vi.waitFor(() => expect(getAdminJob(id)?.status).toBe("failed"));
    const job = getAdminJob(id)!;
    expect(job.error).toBe("engine_blocked");
    expect(job.result).toBeNull();
  });

  it("rejects a second concurrent job of the same kind", async () => {
    let release!: (value: unknown) => void;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const first = startAdminJob("wechat_collect", () => gate);
    expect(() => startAdminJob("wechat_collect", async () => null)).toThrow(
      AdminJobConflictError,
    );
    release(null);
    await vi.waitFor(() =>
      expect(getAdminJob(first)?.status).toBe("succeeded"),
    );
  });

  it("prunes finished jobs after the retention window", async () => {
    const id = startAdminJob("catalog_bootstrap", async () => 1);
    await vi.waitFor(() => expect(getAdminJob(id)?.status).toBe("succeeded"));
    pruneAdminJobs(Date.now() + 31 * 60_000);
    expect(getAdminJob(id)).toBeNull();
  });
});
