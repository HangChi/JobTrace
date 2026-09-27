import { completeReminder } from "@/modules/reminders";
import { problemResponse } from "@/shared/http/problem-response";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    return Response.json(
      await completeReminder((await params).id, await request.json()),
    );
  } catch (error) {
    return problemResponse(error);
  }
}
