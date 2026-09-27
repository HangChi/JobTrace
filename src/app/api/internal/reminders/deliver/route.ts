import { timingSafeEqual } from "node:crypto";
import {
  deliverDueReminders,
  reminderDeliverySchema,
} from "@/modules/reminders";
import { getReminderEnv } from "@/shared/config/env";
import { Problem } from "@/shared/errors/problem";
import { problemResponse } from "@/shared/http/problem-response";

function authorized(request: Request, secret: string | undefined) {
  const supplied =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || supplied.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(secret));
}

export async function POST(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  try {
    const config = getReminderEnv();
    if (!authorized(request, config.secret))
      throw new Problem("unauthorized", "提醒调度凭据无效。", 401);
    const input = reminderDeliverySchema.parse(
      await request.json().catch(() => ({})),
    );
    return Response.json(await deliverDueReminders(input.limit), {
      headers: { "x-request-id": requestId, "cache-control": "no-store" },
    });
  } catch (error) {
    return problemResponse(error, requestId);
  }
}
