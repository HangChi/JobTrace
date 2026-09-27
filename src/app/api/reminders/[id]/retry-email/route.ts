import { retryReminderEmail } from "@/modules/reminders";
import { problemResponse } from "@/shared/http/problem-response";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    return Response.json(
      await retryReminderEmail((await params).id, await request.json()),
      { status: 202 },
    );
  } catch (error) {
    return problemResponse(error);
  }
}
