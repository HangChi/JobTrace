import { revalidatePath } from "next/cache";
import {
  deleteApplication,
  getApplication,
  updateApplication,
} from "@/modules/applications";
import { problemResponse } from "@/shared/http/problem-response";
type Context = { params: Promise<{ id: string }> };
export async function GET(_: Request, { params }: Context) {
  try {
    return Response.json(await getApplication((await params).id));
  } catch (error) {
    return problemResponse(error);
  }
}
export async function PATCH(request: Request, { params }: Context) {
  try {
    return Response.json(
      await updateApplication((await params).id, await request.json()),
    );
  } catch (error) {
    return problemResponse(error);
  }
}
export async function DELETE(_: Request, { params }: Context) {
  try {
    await deleteApplication((await params).id);
    revalidatePath("/");
    return new Response(null, { status: 204 });
  } catch (error) {
    return problemResponse(error);
  }
}
