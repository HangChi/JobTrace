import { logout } from "@/modules/identity-access";
import { problemResponse } from "@/shared/http/problem-response";
import { assertSameOrigin } from "@/modules/identity-access/infrastructure/auth-request-security";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await logout();
    return new Response(null, { status: 204 });
  } catch (e) {
    return problemResponse(e);
  }
}
