import { register } from "@/modules/identity-access";
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
    await checkAuthRateLimit(
      clientRateLimitKey(r, "local-register"),
      "register",
      5,
      60_000,
    );
    await verifyAuthChallenge(r);
    return Response.json(await register(await r.json()), { status: 202 });
  } catch (e) {
    return problemResponse(e);
  }
}
