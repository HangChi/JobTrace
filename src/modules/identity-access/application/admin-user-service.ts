import "server-only";

import { Problem } from "@/shared/errors/problem";
import { logServerEvent } from "@/shared/observability/logger";
import {
  readManagedUser,
  readManagedUserApplications,
  readManagedUserInterviews,
  readManagedUsers,
  readRecentAdminAudit,
  writeUserAccessChange,
} from "../infrastructure/postgres-admin-repository";
import { requireAdmin } from "./authorization";
import {
  accessChangeSchema,
  adminUserContentQuerySchema,
  adminUserQuerySchema,
  type AccessChangeInput,
  type AdminUserQuery,
} from "./admin-query-schema";

export async function listUsers(input: unknown = {}) {
  await requireAdmin();
  let query = adminUserQuerySchema.parse(input);
  let result = await readManagedUsers(query);
  if (result.totalPages > 0 && query.page > result.totalPages) {
    query = { ...query, page: result.totalPages };
    result = await readManagedUsers(query);
  }
  return result;
}

export async function getManagedUserDetail(
  userId: string,
  contentInput: unknown = {},
) {
  const actor = await requireAdmin();
  if (!userId || userId.length > 128)
    throw new Problem("validation", "用户标识无效。", 400);
  const contentQuery = adminUserContentQuerySchema.parse(contentInput);
  const started = performance.now();
  const user = await readManagedUser(userId);
  if (!user) throw new Problem("not_found", "没有找到该用户。", 404);
  const [recentAuditEvents, firstApplications, firstInterviews] =
    await Promise.all([
      readRecentAdminAudit(userId),
      readManagedUserApplications(userId, contentQuery.applicationsPage),
      readManagedUserInterviews(userId, contentQuery.interviewsPage),
    ]);
  let applications = firstApplications;
  let interviews = firstInterviews;
  if (
    applications.totalPages > 0 &&
    applications.page > applications.totalPages
  ) {
    applications = await readManagedUserApplications(
      userId,
      applications.totalPages,
    );
  }
  if (interviews.totalPages > 0 && interviews.page > interviews.totalPages) {
    interviews = await readManagedUserInterviews(userId, interviews.totalPages);
  }
  logServerEvent("admin.user_data_view", {
    actorId: actor.id,
    targetId: userId,
    applicationsPage: applications.page,
    interviewsPage: interviews.page,
    applicationCount: applications.total,
    interviewCount: interviews.total,
    durationMs: Math.round(performance.now() - started),
  });
  return { ...user, recentAuditEvents, applications, interviews };
}

export async function changeManagedUserAccess(userId: string, raw: unknown) {
  const actor = await requireAdmin();
  const input = accessChangeSchema.parse(raw) satisfies AccessChangeInput;
  if (!(await readManagedUser(userId)))
    throw new Problem("not_found", "没有找到该用户。", 404);
  const started = performance.now();
  const result = await writeUserAccessChange(actor.id, userId, input);
  logServerEvent("admin.access_change", {
    requestId: input.requestId,
    actorId: actor.id,
    targetId: userId,
    action: input.action,
    outcome: result.outcome,
    code: result.failureCode,
    durationMs: Math.round(performance.now() - started),
  });
  if (result.outcome !== "succeeded") {
    const messages: Record<string, string> = {
      access_version_conflict: "账号状态已变化，请刷新后重新确认。",
      last_admin: "不能禁用或降级最后一个有效管理员。",
      self_confirmation_required: "当前账号操作需要强化确认。",
      idempotency_conflict: "请求标识已用于其他操作。",
      action_state_conflict: "账号当前状态不允许该操作。",
    };
    throw new Problem(
      result.failureCode ?? "admin_change_failed",
      messages[result.failureCode ?? ""] ?? "操作未完成，请核对最新状态。",
      409,
      undefined,
      {
        auditEventId: result.auditEventId,
        latestAccessState:
          result.role &&
          typeof result.disabled === "boolean" &&
          result.accessVersion
            ? {
                role: result.role,
                disabled: result.disabled,
                accessVersion: result.accessVersion,
              }
            : undefined,
      },
    );
  }
  const user = await readManagedUser(userId);
  if (!user) throw new Problem("not_found", "没有找到该用户。", 404);
  return { user, auditEventId: result.auditEventId, replayed: result.replayed };
}

export type { AdminUserQuery };
