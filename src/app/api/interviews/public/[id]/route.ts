import { getPublicInterview } from "@/modules/interviews";
import { problemResponse } from "@/shared/http/problem-response";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Context) {
  try {
    return Response.json(await getPublicInterview((await params).id));
  } catch (error) {
    return problemResponse(error);
  }
}
