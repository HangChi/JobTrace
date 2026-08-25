import { login } from "@/modules/identity-access";
import { problemResponse } from "@/shared/http/problem-response";
import {
  checkAuthRateLimit,
  clientRateLimitKey,
} from "@/modules/identity-access/infrastructure/auth-rate-limit";
import {
  assertSameOrigin,
  verifyAuthChallenge,
} from "@/modules/identity-access/infrastructure/auth-request-security";
export async function POST(r: Request) {
  try {
    assertSameOrigin(r);
    await checkAuthRateLimit(clientRateLimitKey(r, "local-login"), "login");
    await verifyAuthChallenge(r);
    return Response.json(await login(await r.json()));
  } catch (e) {
    return problemResponse(e);
  }
}
