import { describe, expect, test } from "vitest";
import {
  accessChangeSchema,
  adminAuditQuerySchema,
  adminUserQuerySchema,
} from "@/modules/identity-access/application/admin-query-schema";

describe("admin console contracts", () => {
  test("normalizes directory filters and pages", () => {
    expect(
      adminUserQuerySchema.parse({
        q: "  USER_01  ",
        role: "admin",
        status: "active",
        page: "2",
      }),
    ).toMatchObject({ q: "USER_01", role: "admin", status: "active", page: 2 });
  });

  test("rejects reversed date ranges", () => {
    expect(() =>
      adminAuditQuerySchema.parse({
        occurredFrom: "2026-08-24",
        occurredTo: "2026-08-23",
      }),
    ).toThrow();
  });

  test("requires a stable id, version and meaningful reason", () => {
    expect(() =>
      accessChangeSchema.parse({
        requestId: crypto.randomUUID(),
        expectedVersion: 1,
        action: "disable_user",
        reason: "short",
      }),
    ).toThrow();
    expect(
      accessChangeSchema.parse({
        requestId: crypto.randomUUID(),
        expectedVersion: 1,
        action: "disable_user",
        reason: "Confirmed policy violation",
      }),
    ).toMatchObject({ action: "disable_user", confirmSelf: false });
  });
});
