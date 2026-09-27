import { resolveProgressReminder } from "@/modules/analytics";
import { suggestionResolutionSchema } from "@/modules/reminders";
import { problemResponse } from "@/shared/http/problem-response";

type Context = { params: Promise<{ stageOccurrenceId: string }> };

export async function POST(request: Request, { params }: Context) {
  try {
    const { resolution } = suggestionResolutionSchema.parse(
      await request.json(),
    );
    return Response.json(
      await resolveProgressReminder(
        (await params).stageOccurrenceId,
        resolution,
      ),
    );
  } catch (error) {
    return problemResponse(error);
  }
}
