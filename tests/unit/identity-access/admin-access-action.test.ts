import { describe, expect, test } from "vitest";
import { accessChangeSchema } from "@/modules/identity-access/application/admin-query-schema";

describe("admin access actions", () => {
  const base = {
    requestId: "a8ffcf17-f930-4eb3-97d7-771c152495bf",
    expectedVersion: 1,
    reason: "基于账号访问政策执行本次管理员操作。",
  };

  test.each(["promote_admin", "demote_admin", "disable_user", "enable_user"])(
    "accepts named action %s and preserves reason",
    (action) => {
      expect(accessChangeSchema.parse({ ...base, action })).toMatchObject({
        action,
        reason: base.reason,
        confirmSelf: false,
      });
    },
  );

  test.each([
    { ...base, action: "set_role" },
    { ...base, action: "disable_user", requestId: "unstable" },
    { ...base, action: "disable_user", expectedVersion: 0 },
    { ...base, action: "disable_user", reason: "太短" },
    { ...base, action: "disable_user", reason: "x".repeat(501) },
  ])("rejects unsafe command %#", (command) => {
    expect(() => accessChangeSchema.parse(command)).toThrow();
  });

  test("same payload produces the same canonical fingerprint input", () => {
    const parsed = accessChangeSchema.parse({
      ...base,
      action: "disable_user",
      confirmSelf: true,
    });
    expect(JSON.stringify(parsed)).toBe(JSON.stringify({ ...parsed }));
  });
});
