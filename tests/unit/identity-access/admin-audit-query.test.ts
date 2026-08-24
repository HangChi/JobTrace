import { describe, expect, test } from "vitest";
import { adminAuditQuerySchema } from "@/modules/identity-access/application/admin-query-schema";

describe("admin audit query", () => {
  test("normalizes identity text and round-trips filters", () => {
    const params = new URLSearchParams({
      actor: "  admin@example.test ",
      target: " user-01 ",
      eventType: "disable_user",
      outcome: "conflict",
      occurredFrom: "2026-08-01",
      occurredTo: "2026-08-24",
      page: "2",
    });
    expect(
      adminAuditQuerySchema.parse(Object.fromEntries(params)),
    ).toMatchObject({
      actor: "admin@example.test",
      target: "user-01",
      eventType: "disable_user",
      outcome: "conflict",
      page: 2,
    });
  });

  test.each([
    { eventType: "delete_user" },
    { outcome: "unknown" },
    { page: "-1" },
    { actor: "x".repeat(101) },
    { occurredFrom: "2026-08-24", occurredTo: "2026-08-23" },
  ])("rejects invalid audit filter %#", (input) => {
    expect(() => adminAuditQuerySchema.parse(input)).toThrow();
  });
});
