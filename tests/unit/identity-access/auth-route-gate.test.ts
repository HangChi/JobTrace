import { describe, expect, it } from "vitest";
import { isAllowedPublicAuthRequest } from "@/modules/identity-access/infrastructure/better-auth-route-gate";

describe("Better Auth public route gate", () => {
  it("only exposes the password reset token callback", () => {
    expect(
      isAllowedPublicAuthRequest(
        "GET",
        "/api/auth/reset-password/reset-token_123",
      ),
    ).toBe(true);
  });

  it.each([
    ["POST", "/api/auth/sign-up/email"],
    ["POST", "/api/auth/sign-in/email"],
    ["POST", "/api/auth/sign-in/username"],
    ["POST", "/api/auth/request-password-reset"],
    ["POST", "/api/auth/reset-password"],
    ["POST", "/api/auth/update-user"],
    ["POST", "/api/auth/admin/set-role"],
    ["GET", "/api/auth/get-session"],
    ["POST", "/api/auth/reset-password/reset-token_123"],
    ["GET", "/api/auth/reset-password"],
    ["GET", "/api/auth/reset-password/token/extra"],
    ["GET", "/api/auth/reset-password/token%2Fextra"],
  ])("rejects %s %s", (method, pathname) => {
    expect(isAllowedPublicAuthRequest(method, pathname)).toBe(false);
  });
});
