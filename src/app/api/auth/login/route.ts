import { login } from "@/modules/identity-access";
import { problemResponse } from "@/shared/http/problem-response";
import { checkAuthRateLimit } from "@/modules/identity-access/infrastructure/auth-rate-limit";
import {
  assertSameOrigin,
  verifyAuthChallenge,
} from "@/modules/identity-access/infrastructure/auth-request-security";
export async function POST(r: Request) {
  try {
    assertSameOrigin(r);
    checkAuthRateLimit(r.headers.get("x-forwarded-for") ?? "local-login");
    await verifyAuthChallenge(r);
    return Response.json(await login(await r.json()));
  } catch (e) {
    return problemResponse(e);
  }
}
