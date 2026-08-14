import postgres from "postgres";

if (!process.env.DATABASE_URL) process.loadEnvFile?.(".env.local");

export function testDatabase() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  return postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
}

export function testId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export async function createTestUser(
  sql: ReturnType<typeof postgres>,
  id: string,
  role = "user",
) {
  await sql`insert into users(id,display_name,email,email_verified,role,username,display_username)
    values(${id},${id},${`${id}@example.test`},true,${role},${id.slice(0, 30)},${id.slice(0, 30)})`;
}

export async function cleanupTestUsers(
  sql: ReturnType<typeof postgres>,
  ids: string[],
) {
  await sql`delete from applications where owner_id = any(${ids})`;
  await sql`delete from import_batches where owner_id = any(${ids})`;
  await sql`delete from users where id = any(${ids})`;
  await sql.end();
}
