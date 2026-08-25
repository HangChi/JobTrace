import { requestRegistrationEmailCode } from "@/modules/identity-access";
import { clientRateLimitKey } from "@/modules/identity-access/infrastructure/auth-rate-limit";
import { assertSameOrigin } from "@/modules/identity-access/infrastructure/auth-request-security";
import { problemResponse } from "@/shared/http/problem-response";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = (await request.json()) as { email?: unknown };
    return Response.json(
      await requestRegistrationEmailCode(
        body.email,
        clientRateLimitKey(request, "registration-email-code"),
      ),
      { status: 202 },
    );
  } catch (error) {
    return problemResponse(error);
  }
}
