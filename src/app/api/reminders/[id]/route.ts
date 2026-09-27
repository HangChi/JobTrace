import { cancelReminder, updateReminder } from "@/modules/reminders";
import { problemResponse } from "@/shared/http/problem-response";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  try {
    return Response.json(
      await updateReminder((await params).id, await request.json()),
    );
  } catch (error) {
    return problemResponse(error);
  }
}

export async function DELETE(request: Request, { params }: Context) {
  try {
    return Response.json(
      await cancelReminder((await params).id, await request.json()),
    );
  } catch (error) {
    return problemResponse(error);
  }
}
