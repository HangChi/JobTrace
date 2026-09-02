import { describe, expect, it } from "vitest";
import { SourceError } from "@/modules/job-market/application/source-errors";
import {
  createSecureSourceClient,
  isPublicIp,
  isSyntheticProxyIp,
  validateHttpsUrl,
} from "@/modules/job-market/infrastructure/secure-source-client.server";

describe("job market source request security", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "::1",
    "fc00::1",
    "fe80::1",
  ])("rejects non-public address %s", (address) => {
    expect(isPublicIp(address)).toBe(false);
  });

  it("accepts public addresses", () => {
    expect(isPublicIp("8.8.8.8")).toBe(true);
    expect(isPublicIp("2606:4700:4700::1111")).toBe(true);
    expect(isPublicIp("198.18.0.182")).toBe(false);
    expect(isSyntheticProxyIp("198.18.0.182")).toBe(true);
  });

  it("allows an exact HTTPS host through development proxy Fake-IP only when enabled", async () => {
    const request = {
      allowedHosts: ["jobs.example.com"],
      accept: ["application/json"] as const,
      signal: new AbortController().signal,
    };
    const fetcher = async () =>
      new Response("{}", {
        headers: { "content-type": "application/json" },
      });
    const blocked = createSecureSourceClient({
      resolver: async () => ["198.18.0.182"],
      fetcher,
      allowProxyDns: false,
    });
    await expect(
      blocked("https://jobs.example.com/jobs", request),
    ).rejects.toMatchObject({ code: "unsafe_source_url" });

    const allowed = createSecureSourceClient({
      resolver: async () => ["198.18.0.182"],
      fetcher,
      allowProxyDns: true,
    });
    await expect(
      allowed("https://jobs.example.com/jobs", request),
    ).resolves.toMatchObject({ status: 200 });

    const officialAts = createSecureSourceClient({
      resolver: async () => ["198.18.0.182"],
      fetcher,
      allowProxyDns: false,
    });
    await expect(
      officialAts("https://boards-api.greenhouse.io/v1/boards/demo/jobs", {
        ...request,
        allowedHosts: ["boards-api.greenhouse.io"],
      }),
    ).resolves.toMatchObject({ status: 200 });
  });

  it("requires an exact approved HTTPS host without credentials", () => {
    expect(
      validateHttpsUrl("https://jobs.example.com/open", ["jobs.example.com"])
        .href,
    ).toBe("https://jobs.example.com/open");
    for (const unsafe of [
      "http://jobs.example.com/open",
      "https://jobs.example.com.evil.test/open",
      "https://user:pass@jobs.example.com/open",
    ]) {
      expect(() => validateHttpsUrl(unsafe, ["jobs.example.com"])).toThrow(
        SourceError,
      );
    }
  });

  it("forwards bounded POST requests to exact Feishu recruitment hosts", async () => {
    let received: RequestInit | undefined;
    const client = createSecureSourceClient({
      resolver: async () => ["198.18.0.182"],
      allowProxyDns: false,
      fetcher: async (_url, init) => {
        received = init;
        return new Response("{}", {
          headers: { "content-type": "application/json" },
        });
      },
    });
    await client("https://example.jobs.feishu.cn/api/v1/search/job/posts", {
      allowedHosts: ["example.jobs.feishu.cn"],
      accept: ["application/json"],
      signal: new AbortController().signal,
      method: "POST",
      body: '{"limit":10}',
      headers: { "Content-Type": "application/json" },
    });
    expect(received).toMatchObject({ method: "POST", body: '{"limit":10}' });
  });

  it("revalidates redirects and refuses private DNS results", async () => {
    const client = createSecureSourceClient({
      resolver: async (host) =>
        host === "jobs.example.com" ? ["8.8.8.8"] : ["127.0.0.1"],
      fetcher: async () =>
        new Response(null, {
          status: 302,
          headers: { location: "https://private.example.com/jobs" },
        }),
    });
    await expect(
      client("https://jobs.example.com/jobs", {
        allowedHosts: ["jobs.example.com", "private.example.com"],
        accept: ["application/json"],
        signal: new AbortController().signal,
      }),
    ).rejects.toMatchObject({ code: "unsafe_source_url" });
  });

  it("enforces response size and content type", async () => {
    const client = createSecureSourceClient({
      resolver: async () => ["8.8.8.8"],
      maxResponseBytes: 4,
      fetcher: async () =>
        new Response("12345", {
          headers: { "content-type": "application/json" },
        }),
    });
    await expect(
      client("https://jobs.example.com/jobs", {
        allowedHosts: ["jobs.example.com"],
        accept: ["application/json"],
        signal: new AbortController().signal,
      }),
    ).rejects.toMatchObject({ code: "response_too_large" });
  });
});
