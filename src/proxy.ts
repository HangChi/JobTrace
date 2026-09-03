import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { Problem } from "@/shared/errors/problem";
import { assertMutationRequest } from "@/shared/http/request-security";

function contentSecurityPolicy(nonce: string) {
  const development = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(development ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const requestId = crypto.randomUUID();
  const csp = contentSecurityPolicy(nonce);
  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.set("Content-Security-Policy", csp);
  forwardedHeaders.set("x-nonce", nonce);
  forwardedHeaders.set("x-request-id", requestId);
  const apiRequest = request.nextUrl.pathname.startsWith("/api/");
  if (apiRequest && !["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    try {
      assertMutationRequest(request);
    } catch (error) {
      const problem =
        error instanceof Problem
          ? error
          : new Problem("invalid_request", "请求无效。", 400);
      const response = NextResponse.json(
        {
          code: problem.code,
          message: problem.message,
          requestId,
        },
        { status: problem.status, headers: { "x-request-id": requestId } },
      );
      response.headers.set("Content-Security-Policy", csp);
      return response;
    }
  }
  const sessionCookie = getSessionCookie(request);
  const publicPath = [
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
  ].some((path) => request.nextUrl.pathname.startsWith(path));
  if (!sessionCookie && !publicPath && !apiRequest) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.searchParams.set("returnTo", request.nextUrl.pathname);
    const response = NextResponse.redirect(login);
    response.headers.set("Content-Security-Policy", csp);
    response.headers.set("x-request-id", requestId);
    return response;
  }
  const response = NextResponse.next({
    request: { headers: forwardedHeaders },
  });
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("x-request-id", requestId);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.svg|favicon.ico).*)"],
};
