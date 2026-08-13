import "server-only";
import postgres from "postgres";
import { getDatabaseEnv } from "@/shared/config/env";

let client: ReturnType<typeof postgres> | undefined;

export function createServerDatabase() {
  client ??= postgres(getDatabaseEnv().DATABASE_URL, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
    transform: postgres.camel,
  });
  return client;
}
