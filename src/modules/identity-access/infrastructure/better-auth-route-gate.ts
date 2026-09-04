const RESET_PASSWORD_CALLBACK = /^\/api\/auth\/reset-password\/[A-Za-z0-9_-]+$/;

export function isAllowedPublicAuthRequest(method: string, pathname: string) {
  return method === "GET" && RESET_PASSWORD_CALLBACK.test(pathname);
}
