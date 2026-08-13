import { login } from "@/modules/identity-access";
import { problemResponse } from "@/shared/http/problem-response";
import { checkAuthRateLimit } from "@/modules/identity-access/infrastructure/auth-rate-limit";
export async function POST(r: Request) {
  try {
    checkAuthRateLimit(r.headers.get("x-forwarded-for") ?? "local-login");
    return Response.json(await login(await r.json()));
  } catch (e) {
    return problemResponse(e);
  }
}
