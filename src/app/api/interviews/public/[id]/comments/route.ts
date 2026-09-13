import {
  addPublicInterviewComment,
  listPublicInterviewComments,
} from "@/modules/interviews";
import { problemResponse } from "@/shared/http/problem-response";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Context) {
  try {
    return Response.json(await listPublicInterviewComments((await params).id));
  } catch (error) {
    return problemResponse(error);
  }
}

export async function POST(request: Request, { params }: Context) {
  try {
    const result = await addPublicInterviewComment(
      (await params).id,
      await request.json(),
    );
    return Response.json(result, { status: 201 });
  } catch (error) {
    return problemResponse(error);
  }
}
