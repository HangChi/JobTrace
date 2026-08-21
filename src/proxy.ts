import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  const publicPath = [
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
  ].some((path) => request.nextUrl.pathname.startsWith(path));
  const apiRequest = request.nextUrl.pathname.startsWith("/api/");
  if (!sessionCookie && !publicPath && !apiRequest) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.searchParams.set("returnTo", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.svg|favicon.ico).*)"],
};
