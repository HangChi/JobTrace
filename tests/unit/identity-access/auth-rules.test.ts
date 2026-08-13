import { describe, expect, it } from "vitest";
import {
  loginSchema,
  registerSchema,
  safeReturnTo,
} from "@/modules/identity-access/application/auth-schema";
describe("identity access rules", () => {
  it("never accepts a role from public registration", () => {
    const parsed = registerSchema.parse({
      username: "Test_User",
      password: "12345678",
      role: "admin",
    });
    expect(parsed).not.toHaveProperty("role");
    expect(parsed.username).toBe("test_user");
  });
  it("allows only same-origin relative return paths", () => {
    expect(safeReturnTo("/applications/1?q=x")).toBe("/applications/1?q=x");
    expect(safeReturnTo("//evil.example")).toBeNull();
    expect(safeReturnTo("https://evil.example")).toBeNull();
  });
  it("validates login inputs", () => {
    expect(loginSchema.safeParse({ username: "!", password: "x" }).success).toBe(false);
  });
});
