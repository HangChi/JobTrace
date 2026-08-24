import { describe, expect, test } from "vitest";
import { adminUserQuerySchema } from "@/modules/identity-access/application/admin-query-schema";

describe("admin user query", () => {
  test("normalizes optional text and round-trips URL values", () => {
    const params = new URLSearchParams({
      q: "  user+ops@example.test  ",
      role: "admin",
      status: "disabled",
      registeredFrom: "2026-08-01",
      registeredTo: "2026-08-24",
      page: "3",
      limit: "25",
    });
    expect(adminUserQuerySchema.parse(Object.fromEntries(params))).toEqual({
      q: "user+ops@example.test",
      role: "admin",
      status: "disabled",
      registeredFrom: "2026-08-01",
      registeredTo: "2026-08-24",
      page: 3,
      limit: 25,
    });
  });

  test.each([
    { q: "x".repeat(101) },
    { page: "0" },
    { page: "not-a-number" },
    { role: "owner" },
    { status: "locked" },
    { registeredFrom: "2026-08-24", registeredTo: "2026-08-01" },
  ])("rejects invalid query %#", (input) => {
    expect(() => adminUserQuerySchema.parse(input)).toThrow();
  });

  test("treats blank search as absent and applies stable defaults", () => {
    expect(adminUserQuerySchema.parse({ q: "   " })).toEqual({
      role: "all",
      status: "all",
      page: 1,
      limit: 50,
    });
  });
});
