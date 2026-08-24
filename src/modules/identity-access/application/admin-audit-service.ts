import "server-only";

import { adminAuditQuerySchema } from "./admin-query-schema";
import { requireAdmin } from "./authorization";
import { readAdminAuditEvents } from "../infrastructure/postgres-admin-repository";

export async function listAdminAuditEvents(input: unknown = {}) {
  await requireAdmin();
  let query = adminAuditQuerySchema.parse(input);
  let result = await readAdminAuditEvents(query);
  if (result.totalPages > 0 && query.page > result.totalPages) {
    query = { ...query, page: result.totalPages };
    result = await readAdminAuditEvents(query);
  }
  return result;
}
