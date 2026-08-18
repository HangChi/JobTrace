import {
  deleteInterview,
  getInterview,
  updateInterview,
} from "@/modules/interviews";
import { problemResponse } from "@/shared/http/problem-response";

type Context = { params: Promise<{ id: string }> };
export async function GET(_: Request, { params }: Context) {
  try {
    return Response.json(await getInterview((await params).id));
  } catch (error) {
    return problemResponse(error);
  }
}
export async function PATCH(request: Request, { params }: Context) {
  try {
    return Response.json(
      await updateInterview((await params).id, await request.json()),
    );
  } catch (error) {
    return problemResponse(error);
  }
}
export async function DELETE(_: Request, { params }: Context) {
  try {
    await deleteInterview((await params).id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return problemResponse(error);
  }
}
