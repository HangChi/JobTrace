import { createServerDatabase } from "@/shared/database";
import { logServerEvent } from "@/shared/observability/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  const started = performance.now();
  try {
    const sql = createServerDatabase();
    await sql`select 1 from public.applications limit 1`;
    logServerEvent("health_check", {
      durationMs: Math.round(performance.now() - started),
      result: "ok",
    });
    return Response.json(
      { status: "ok" },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    logServerEvent("health_check", {
      durationMs: Math.round(performance.now() - started),
      result: "error",
    });
    return Response.json({ status: "error" }, { status: 503 });
  }
}
