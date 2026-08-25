import "server-only";
import postgres from "postgres";
import { getDatabaseEnv } from "@/shared/config/env";

let client: ReturnType<typeof postgres> | undefined;

export function createServerDatabase() {
  const env = getDatabaseEnv();
  client ??= postgres(env.DATABASE_URL, {
    max: env.DATABASE_APP_POOL_MAX,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
    transform: postgres.camel,
  });
  return client;
}
