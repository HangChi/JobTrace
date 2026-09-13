import { togglePublicInterviewLike } from "@/modules/interviews";
import { problemResponse } from "@/shared/http/problem-response";

type Context = { params: Promise<{ id: string }> };

export async function POST(_: Request, { params }: Context) {
  try {
    return Response.json(await togglePublicInterviewLike((await params).id));
  } catch (error) {
    return problemResponse(error);
  }
}
