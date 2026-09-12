import { requireAdmin } from "@/modules/identity-access";
import { Problem } from "@/shared/errors/problem";
import {
  AdminJobConflictError,
  getAdminJob,
  startAdminJob,
  type AdminJobKind,
  type AdminJobReporter,
  type AdminJobSnapshot,
} from "./admin-jobs";

// 鉴权只在任务启动与状态查询时进行；任务体在后台运行，
// 不得触碰请求上下文（cookie/header/next-cache）。
export async function startJobMarketJob(
  kind: AdminJobKind,
  run: (report: AdminJobReporter) => Promise<unknown>,
): Promise<string> {
  await requireAdmin();
  try {
    return startAdminJob(kind, run);
  } catch (error) {
    if (error instanceof AdminJobConflictError)
      throw new Problem(
        "conflict",
        "同类任务正在进行，请等待完成后再试。",
        409,
      );
    throw error;
  }
}

export async function getJobMarketJob(
  kind: AdminJobKind,
  jobId: string | null,
): Promise<AdminJobSnapshot> {
  await requireAdmin();
  if (!jobId) throw new Problem("validation", "缺少 jobId 查询参数。", 400);
  const job = getAdminJob(jobId);
  if (!job || job.kind !== kind)
    throw new Problem("not_found", "任务不存在或已过期。", 404);
  return job;
}
