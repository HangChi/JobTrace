import type postgres from "postgres";

export type AdminConsoleSql = ReturnType<typeof postgres>;

export type AdminConsoleUserFixture = {
  id: string;
  username?: string;
  role?: "user" | "admin";
  disabled?: boolean;
  createdAt?: Date;
};

export async function seedAdminConsoleUser(
  sql: AdminConsoleSql,
  fixture: AdminConsoleUserFixture,
) {
  const username = fixture.username ?? fixture.id.slice(0, 30);
  await sql`insert into users(
      id,display_name,email,email_verified,role,disabled,username,display_username,created_at,updated_at
    ) values(
      ${fixture.id},${username},${`${username}@example.test`},true,
      ${fixture.role ?? "user"},${fixture.disabled ?? false},${username},${username},
      ${fixture.createdAt ?? new Date()},${fixture.createdAt ?? new Date()}
    )`;
}

export async function seedAdminConsoleSession(
  sql: AdminConsoleSql,
  userId: string,
  createdAt = new Date(),
) {
  const id = crypto.randomUUID();
  await sql`insert into sessions(id,expires_at,token,created_at,updated_at,user_id)
    values(${id},${new Date(createdAt.getTime() + 86_400_000)},${`token-${id}`},${createdAt},${createdAt},${userId})`;
  return id;
}

export async function seedAdminAuditEvent(
  sql: AdminConsoleSql,
  input: {
    actorId: string;
    targetUserId: string;
    eventType?:
      "promote_admin" | "demote_admin" | "disable_user" | "enable_user";
    outcome?: "succeeded" | "denied" | "conflict" | "failed";
    reason?: string;
    createdAt?: Date;
  },
) {
  const requestId = crypto.randomUUID();
  const [event] = await sql<{ id: string }[]>`insert into admin_audit_events(
      request_id,request_fingerprint,actor_id,actor_identifier_snapshot,
      target_user_id,target_identifier_snapshot,event_type,outcome,reason,
      before_data,after_data,created_at
    ) select ${requestId},${`fixture:${requestId}`},a.id,a.email,t.id,t.email,
      ${input.eventType ?? "promote_admin"},${input.outcome ?? "succeeded"},
      ${input.reason ?? "Automated fixture reason"},
      ${sql.json({ role: "user", disabled: false, accessVersion: 1 })},
      ${sql.json({ role: "admin", disabled: false, accessVersion: 2 })},
      ${input.createdAt ?? new Date()}
    from users a cross join users t
    where a.id=${input.actorId} and t.id=${input.targetUserId}
    returning id`;
  return { id: event.id, requestId };
}
