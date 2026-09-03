import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "@/proxy";

describe("proxy security headers", () => {
  it("uses a per-request nonce instead of allowing inline scripts", () => {
    const response = proxy(new NextRequest("http://localhost/login"));
    const policy = response.headers.get("content-security-policy") ?? "";
    const scriptPolicy = policy
      .split(";")
      .find((directive) => directive.trim().startsWith("script-src"));

    expect(scriptPolicy).toMatch(/'nonce-[a-f0-9]+'/);
    expect(scriptPolicy).toContain("'strict-dynamic'");
    expect(scriptPolicy).not.toContain("'unsafe-inline'");
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("also attaches security headers to rejected mutations", async () => {
    const response = proxy(
      new NextRequest("http://localhost/api/profile", {
        method: "POST",
        headers: { "sec-fetch-site": "cross-site" },
      }),
    );

    expect(response.status).toBe(403);
    expect(response.headers.get("content-security-policy")).toContain(
      "frame-ancestors 'none'",
    );
    await expect(response.json()).resolves.toMatchObject({
      code: "csrf_rejected",
      requestId: expect.any(String),
    });
  });
});
