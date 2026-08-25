import { describe, expect, it } from "vitest";
import {
  loginSchema,
  passwordSchema,
  registerFormSchema,
  registerSchema,
  safeReturnTo,
} from "@/modules/identity-access/application/auth-schema";
describe("identity access rules", () => {
  it("never accepts a role from public registration", () => {
    const parsed = registerSchema.parse({
      username: "Test_User",
      email: "USER@example.com",
      verificationCode: "123456",
      password: "12345678",
      role: "admin",
    });
    expect(parsed).not.toHaveProperty("role");
    expect(parsed.username).toBe("test_user");
  });
  it("allows only same-origin relative return paths", () => {
    expect(safeReturnTo("/applications/1?q=x")).toBe("/applications/1?q=x");
    expect(safeReturnTo(undefined)).toBeNull();
    expect(safeReturnTo("//evil.example")).toBeNull();
    expect(safeReturnTo("https://evil.example")).toBeNull();
  });
  it("validates login inputs", () => {
    expect(
      loginSchema.safeParse({ username: "!", password: "x" }).success,
    ).toBe(false);
  });

  it("accepts only passwords between 8 and 16 characters", () => {
    expect(passwordSchema.safeParse("1234567").success).toBe(false);
    expect(passwordSchema.safeParse("12345678").success).toBe(true);
    expect(passwordSchema.safeParse("1234567890123456").success).toBe(true);
    expect(passwordSchema.safeParse("12345678901234567").success).toBe(false);
  });

  it("requires matching password confirmation on the registration form", () => {
    const mismatch = registerFormSchema.safeParse({
      username: "Trace_User",
      email: "trace@example.com",
      verificationCode: "123456",
      password: "12345678",
      confirmPassword: "87654321",
      displayName: "",
    });
    expect(mismatch.success).toBe(false);
    if (!mismatch.success) {
      expect(mismatch.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ["confirmPassword"],
            message: "两次输入的密码不一致",
          }),
        ]),
      );
    }

    const valid = registerFormSchema.parse({
      username: "Trace_User",
      email: "trace@example.com",
      verificationCode: "123456",
      password: "12345678",
      confirmPassword: "12345678",
      displayName: "",
    });
    expect(valid.username).toBe("trace_user");
    expect(valid.displayName).toBeUndefined();
  });
});
