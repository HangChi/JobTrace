import "server-only";

import { createServerDatabase } from "@/shared/database";
import { Problem } from "@/shared/errors/problem";
import { requireAdmin } from "./authorization";
import { accountRoles, type AccountRole } from "./contracts";

export async function listUsers(page = 1, perPage = 50) {
  await requireAdmin();
  const safeLimit = Math.min(100, Math.max(1, perPage));
  const offset = (Math.max(1, page) - 1) * safeLimit;
  const sql = createServerDatabase();
  const users = await sql<
    Array<{
      id: string;
      email: string;
      role: AccountRole;
      displayName: string;
      disabled: boolean;
      createdAt: Date;
      lastSignInAt: Date | null;
    }>
  >`select u.id,u.email,u.role,u.display_name,u.disabled,u.created_at,
      (select max(s.created_at) from sessions s where s.user_id=u.id) last_sign_in_at
    from users u order by u.created_at desc limit ${safeLimit} offset ${offset}`;
  return users.map((user) => ({
    ...user,
    createdAt: user.createdAt.toISOString(),
    lastSignInAt: user.lastSignInAt?.toISOString() ?? null,
  }));
}

export async function updateUserAccess(
  userId: string,
  input: { role?: string; disabled?: boolean },
) {
  const actor = await requireAdmin();
  const sql = createServerDatabase();
  const [current] = await sql<
    Array<{ role: AccountRole; disabled: boolean }>
  >`select role,disabled from users where id=${userId}`;
  if (!current) throw new Problem("not_found", "没有找到该用户。", 404);
  const role =
    input.role && accountRoles.includes(input.role as AccountRole)
      ? (input.role as AccountRole)
      : current.role;
  const disabled = input.disabled ?? current.disabled;
  try {
    const [user] =
      await sql`select * from public.update_user_access_as(${actor.id},${userId},${role},${disabled})`;
    return user;
  } catch (error) {
    if ((error as { code?: string }).code === "23514")
      throw new Problem("last_admin", "不能禁用或降级最后一个管理员。", 409);
    throw error;
  }
}
