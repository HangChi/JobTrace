import { logout } from "@/modules/identity-access";
import { problemResponse } from "@/shared/http/problem-response";
export async function POST() {
  try {
    await logout();
    return new Response(null, { status: 204 });
  } catch (e) {
    return problemResponse(e);
  }
}
