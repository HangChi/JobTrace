import { describe, expect, it } from "vitest";
import { safeReturnTo } from "@/modules/identity-access/application/auth-schema";

describe("authentication security", () => {
  it.each(["https://evil.test", "//evil.test", "javascript:alert(1)"])(
    "rejects unsafe return target %s",
    (value) => {
      expect(safeReturnTo(value)).toBeNull();
    },
  );

  it("allows same-origin relative paths", () => {
    expect(safeReturnTo("/applications/new?q=1")).toBe("/applications/new?q=1");
  });
});
