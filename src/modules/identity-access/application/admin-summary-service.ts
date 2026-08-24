import "server-only";
import { requireAdmin } from "./authorization";
import type { AdminOperationalSummary } from "./contracts";
import {
  readAdminActivity,
  readAdminCounts,
} from "../infrastructure/postgres-admin-repository";

export async function getAdminSummary() {
  await requireAdmin();
  const [counts, activity] = await Promise.allSettled([
    readAdminCounts(),
    readAdminActivity(),
  ]);
  return {
    generatedAt: new Date().toISOString(),
    timeZone: "Asia/Shanghai",
    activityDefinition: "统计周期内至少创建一次有效登录会话的未禁用用户",
    counts:
      counts.status === "fulfilled"
        ? { status: "available", value: counts.value }
        : { status: "unavailable" },
    activity:
      activity.status === "fulfilled"
        ? { status: "available", ...activity.value }
        : { status: "unavailable" },
  } satisfies AdminOperationalSummary;
}
