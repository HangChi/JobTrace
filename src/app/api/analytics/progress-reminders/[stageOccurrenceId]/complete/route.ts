import { completeProgressReminder } from "@/modules/analytics";
import { problemResponse } from "@/shared/http/problem-response";

type Context = { params: Promise<{ stageOccurrenceId: string }> };

export async function POST(_: Request, { params }: Context) {
  try {
    return Response.json(
      await completeProgressReminder((await params).stageOccurrenceId),
    );
  } catch (error) {
    return problemResponse(error);
  }
}
