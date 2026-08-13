import { updateUserAccess } from "@/modules/identity-access";
import { problemResponse } from "@/shared/http/problem-response";
export async function PATCH(
  r: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    return Response.json(
      await updateUserAccess((await params).id, await r.json()),
    );
  } catch (e) {
    return problemResponse(e);
  }
}
