import { afterEach, describe, expect, test, vi } from "vitest";
import { assertSameOrigin } from "@/shared/http/request-security";

describe("admin mutation origin checks", () => {
  afterEach(() => vi.unstubAllEnvs());

  test("accepts the configured origin and server-side calls", () => {
    vi.stubEnv("BETTER_AUTH_URL", "https://jobtrace.example");
    vi.stubEnv(
      "BETTER_AUTH_SECRET",
      "test-secret-at-least-thirty-two-bytes-long",
    );
    expect(() =>
      assertSameOrigin(new Request("https://jobtrace.example/api")),
    ).not.toThrow();
    expect(() =>
      assertSameOrigin(
        new Request("https://jobtrace.example/api", {
          headers: { origin: "https://jobtrace.example" },
        }),
      ),
    ).not.toThrow();
  });

  test("rejects a cross-origin mutation", () => {
    vi.stubEnv("BETTER_AUTH_URL", "https://jobtrace.example");
    vi.stubEnv(
      "BETTER_AUTH_SECRET",
      "test-secret-at-least-thirty-two-bytes-long",
    );
    expect(() =>
      assertSameOrigin(
        new Request("https://jobtrace.example/api", {
          headers: { origin: "https://evil.example" },
        }),
      ),
    ).toThrowError("请求来源无效。");
  });
});
