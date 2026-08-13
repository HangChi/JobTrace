import { addApplicationStage } from "@/modules/applications";
import { problemResponse } from "@/shared/http/problem-response";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  try {
    return Response.json(
      await addApplicationStage((await params).id, await request.json()),
      { status: 201 },
    );
  } catch (error) {
    return problemResponse(error);
  }
}
