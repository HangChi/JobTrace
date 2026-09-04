import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/modules/identity-access/infrastructure/better-auth.server";
import { isAllowedPublicAuthRequest } from "@/modules/identity-access/infrastructure/better-auth-route-gate";

const betterAuthHandlers = toNextJsHandler(auth);

async function guardedBetterAuthHandler(request: Request) {
  if (
    !isAllowedPublicAuthRequest(request.method, new URL(request.url).pathname)
  ) {
    return new Response(null, { status: 404 });
  }
  return betterAuthHandlers.GET(request);
}

export const GET = guardedBetterAuthHandler;
export const POST = guardedBetterAuthHandler;
export const PATCH = guardedBetterAuthHandler;
export const PUT = guardedBetterAuthHandler;
export const DELETE = guardedBetterAuthHandler;
