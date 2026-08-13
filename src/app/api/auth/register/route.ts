import { register } from "@/modules/identity-access";
import { problemResponse } from "@/shared/http/problem-response";
import { checkAuthRateLimit } from "@/modules/identity-access/infrastructure/auth-rate-limit";
export async function POST(r: Request) {
  try {
    checkAuthRateLimit(
      r.headers.get("x-forwarded-for") ?? "local-register",
      5,
      60_000,
    );
    return Response.json(await register(await r.json()), { status: 202 });
  } catch (e) {
    return problemResponse(e);
  }
}
