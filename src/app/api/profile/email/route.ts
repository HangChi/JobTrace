import { bindEmail, unbindEmail } from "@/modules/identity-access";
import { assertSameOrigin } from "@/modules/identity-access/infrastructure/auth-request-security";
import { problemResponse } from "@/shared/http/problem-response";

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    return Response.json(await bindEmail(await request.json()));
  } catch (error) {
    return problemResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    return Response.json(await unbindEmail(await request.json()));
  } catch (error) {
    return problemResponse(error);
  }
}
