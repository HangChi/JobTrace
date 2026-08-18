import { updateProfile } from "@/modules/identity-access";
import { problemResponse } from "@/shared/http/problem-response";

export async function PATCH(request: Request) {
  try {
    return Response.json(await updateProfile(await request.json()));
  } catch (error) {
    return problemResponse(error);
  }
}
