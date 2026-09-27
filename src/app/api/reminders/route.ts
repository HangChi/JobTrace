import { createReminder, getReminderSummary } from "@/modules/reminders";
import { problemResponse } from "@/shared/http/problem-response";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const value = new URL(request.url).searchParams.get("status");
    const status =
      value === "completed" || value === "cancelled" ? value : "active";
    return Response.json(await getReminderSummary(status), {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return problemResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    return Response.json(await createReminder(await request.json()), {
      status: 201,
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return problemResponse(error);
  }
}
