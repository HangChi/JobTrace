import {
  removeApplicationStage,
  updateApplicationStage,
} from "@/modules/applications";
import { problemResponse } from "@/shared/http/problem-response";

type Context = { params: Promise<{ id: string; occurrenceId: string }> };

export async function DELETE(request: Request, { params }: Context) {
  try {
    const values = await params;
    return Response.json(
      await removeApplicationStage(
        values.id,
        values.occurrenceId,
        await request.json(),
      ),
    );
  } catch (error) {
    return problemResponse(error);
  }
}

export async function PATCH(request: Request, { params }: Context) {
  try {
    const values = await params;
    return Response.json(
      await updateApplicationStage(
        values.id,
        values.occurrenceId,
        await request.json(),
      ),
    );
  } catch (error) {
    return problemResponse(error);
  }
}
