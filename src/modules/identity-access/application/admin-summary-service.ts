import "server-only";
import { createServerDatabase } from "@/shared/database";
import { requireAdmin } from "./authorization";
export async function getAdminSummary() {
  await requireAdmin();
  const sql = createServerDatabase();
  const [summary] = await sql<
    Array<{ users: number; disabledUsers: number; applications: number }>
  >`select (select count(*)::int from users) users,(select count(*)::int from users where disabled is true) disabled_users,(select count(*)::int from applications) applications`;
  return summary;
}
