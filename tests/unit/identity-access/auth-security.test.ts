import { describe, expect, it } from "vitest";
import { safeReturnTo } from "@/modules/identity-access/application/auth-schema";
import { assertMutationRequest } from "@/shared/http/request-security";

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

  it("rejects cross-site and oversized mutation requests", () => {
    expect(() =>
      assertMutationRequest(
        new Request("http://localhost/api/profile", {
          method: "POST",
          headers: { "sec-fetch-site": "cross-site" },
        }),
      ),
    ).toThrowError(expect.objectContaining({ code: "csrf_rejected" }));
    expect(() =>
      assertMutationRequest(
        new Request("http://localhost/api/profile", {
          method: "POST",
          headers: { "content-length": String(6 * 1024 * 1024 + 1) },
        }),
      ),
    ).toThrowError(expect.objectContaining({ code: "payload_too_large" }));
  });
});
