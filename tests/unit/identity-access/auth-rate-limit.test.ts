import { afterEach, describe, expect, it, vi } from "vitest";
import { clientRateLimitKey } from "@/modules/identity-access/infrastructure/auth-rate-limit";

function headers(values: Record<string, string> = {}) {
  return new Headers(values);
}

const untrustedHeaderCases: Array<Record<string, string>> = [
  {},
  { "x-forwarded-for": "not-an-ip" },
  { "x-forwarded-for": "198.51.100.10, 127.0.0.1" },
  { "x-real-ip": "198.51.100.10" },
];

describe("authentication client rate-limit keys", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("ignores client-supplied forwarding headers by default", () => {
    vi.stubEnv("AUTH_TRUST_PROXY_HEADERS", "false");
    expect(
      clientRateLimitKey(
        headers({
          "x-forwarded-for": "198.51.100.10",
          "x-real-ip": "198.51.100.11",
        }),
        "shared-login",
      ),
    ).toBe("shared-login");
  });

  it.each([
    ["198.51.100.10", "198.51.100.10"],
    ["2001:0DB8:0:0:0:0:0:1", "2001:db8::1"],
  ])("normalizes a trusted singleton address %s", (input, expected) => {
    vi.stubEnv("AUTH_TRUST_PROXY_HEADERS", "true");
    expect(
      clientRateLimitKey(headers({ "x-forwarded-for": input }), "shared-login"),
    ).toBe(expected);
  });

  it.each(untrustedHeaderCases)(
    "fails closed for an untrusted header shape %#",
    (values) => {
      vi.stubEnv("AUTH_TRUST_PROXY_HEADERS", "true");
      expect(clientRateLimitKey(headers(values), "shared-login")).toBe(
        "shared-login",
      );
    },
  );
});
