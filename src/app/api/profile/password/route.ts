import { changePassword } from "@/modules/identity-access";
import { problemResponse } from "@/shared/http/problem-response";

export async function POST(request: Request) {
  try {
    return Response.json(await changePassword(await request.json()));
  } catch (error) {
    return problemResponse(error);
  }
}
