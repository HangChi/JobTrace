import { createServerDatabase } from "@/shared/database";
import { logServerError, logServerEvent } from "@/shared/observability/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  const started = performance.now();
  try {
    const sql = createServerDatabase();
    const [state] = await sql<
      Array<{
        applications: string | null;
        users: string | null;
        rateLimits: string | null;
      }>
    >`
      select
        to_regclass('public.applications')::text as applications,
        to_regclass('public.users')::text as users,
        to_regclass('public.auth_rate_limits')::text as rate_limits
    `;
    if (!state?.applications || !state.users || !state.rateLimits) {
      throw new Error("required_database_objects_missing");
    }
    const durationMs = Math.round(performance.now() - started);
    logServerEvent("readiness_check", { durationMs, result: "ok" });
    return Response.json(
      { status: "ready", checks: { database: "ok", schema: "ok" } },
      {
        headers: {
          "cache-control": "no-store",
          "server-timing": `database;dur=${durationMs}`,
        },
      },
    );
  } catch (error) {
    const durationMs = Math.round(performance.now() - started);
    logServerError("readiness_check", error, {
      durationMs,
      result: "error",
    });
    return Response.json(
      {
        status: "unavailable",
        checks: { database: "error", schema: "unknown" },
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
