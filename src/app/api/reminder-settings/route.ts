import {
  getReminderPreferences,
  updateReminderPreferences,
} from "@/modules/reminders";
import { problemResponse } from "@/shared/http/problem-response";

export async function GET() {
  try {
    return Response.json(await getReminderPreferences(), {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return problemResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    return Response.json(
      await updateReminderPreferences(await request.json()),
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return problemResponse(error);
  }
}
