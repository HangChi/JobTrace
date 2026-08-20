import { updateApplicationStatus } from "@/modules/applications";
import { problemResponse } from "@/shared/http/problem-response";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  try {
    return Response.json(
      await updateApplicationStatus((await params).id, await request.json()),
    );
  } catch (error) {
    return problemResponse(error);
  }
}
