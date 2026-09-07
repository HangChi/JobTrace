import { describe, expect, it, vi } from "vitest";
import { SourceError } from "@/modules/job-market/application/source-errors";
import {
  createPinnedLookup,
  createSecureSourceClient,
  isPublicIp,
  isSyntheticProxyIp,
  validateHttpsUrl,
} from "@/modules/job-market/infrastructure/secure-source-client.server";

describe("job market source request security", () => {
  const runLookup = (
    lookup: ReturnType<typeof createPinnedLookup>,
    hostname: string,
    options: { all?: boolean; family?: 0 | 4 | 6 | "IPv4" | "IPv6" },
  ) =>
    new Promise<{
      address: string | { address: string; family: number }[];
      family?: number;
    }>((resolve, reject) =>
      lookup(hostname, options, (error, address, family) => {
        if (error) reject(error);
        else resolve({ address, family });
      }),
    );

  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "::1",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "::ffff:10.0.0.1",
    "::ffff:172.16.0.1",
    "::ffff:192.168.1.1",
    "::ffff:169.254.169.254",
    "::ffff:7f00:1",
    "::ffff:a00:1",
    "::ffff:ac10:1",
    "::ffff:c0a8:101",
    "::ffff:a9fe:a9fe",
    "0:0:0:0:0:ffff:7f00:1",
  ])("rejects non-public address %s", (address) => {
    expect(isPublicIp(address)).toBe(false);
  });

  it("accepts public addresses", () => {
    expect(isPublicIp("8.8.8.8")).toBe(true);
    expect(isPublicIp("::ffff:8.8.8.8")).toBe(true);
    expect(isPublicIp("::ffff:808:808")).toBe(true);
    expect(isPublicIp("2606:4700:4700::1111")).toBe(true);
    expect(isPublicIp("198.18.0.182")).toBe(false);
    expect(isSyntheticProxyIp("198.18.0.182")).toBe(true);
  });

  it("serves only pinned addresses to the expected hostname and family", async () => {
    const lookup = createPinnedLookup("jobs.example.com", [
      "8.8.8.8",
      "2606:4700:4700::1111",
    ]);
    await expect(
      runLookup(lookup, "jobs.example.com", { all: true }),
    ).resolves.toEqual({
      address: [
        { address: "8.8.8.8", family: 4 },
        { address: "2606:4700:4700::1111", family: 6 },
      ],
      family: undefined,
    });
    await expect(
      runLookup(lookup, "jobs.example.com", { family: 6 }),
    ).resolves.toEqual({
      address: "2606:4700:4700::1111",
      family: 6,
    });
    await expect(
      runLookup(lookup, "other.example.com", {}),
    ).rejects.toMatchObject({ code: "ENOTFOUND" });
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

  it("pins the validated DNS result into the transport", async () => {
    const close = vi.fn(async () => undefined);
    const dispatcher = {};
    const resolver = vi
      .fn<(hostname: string) => Promise<string[]>>()
      .mockResolvedValueOnce(["8.8.8.8", "2606:4700:4700::1111"])
      .mockResolvedValue(["127.0.0.1"]);
    const dispatcherFactory = vi.fn(() => ({
      dispatcher: dispatcher as never,
      close,
    }));
    const client = createSecureSourceClient({
      resolver,
      dispatcherFactory,
      fetcher: async (_url, init) => {
        expect(init?.dispatcher).toBe(dispatcher);
        return new Response("{}", {
          headers: { "content-type": "application/json" },
        });
      },
    });

    await expect(
      client("https://jobs.example.com/jobs", {
        allowedHosts: ["jobs.example.com"],
        accept: ["application/json"],
        signal: new AbortController().signal,
      }),
    ).resolves.toMatchObject({ status: 200 });
    expect(resolver).toHaveBeenCalledTimes(1);
    expect(dispatcherFactory).toHaveBeenCalledWith("jobs.example.com", [
      "8.8.8.8",
      "2606:4700:4700::1111",
    ]);
    expect(close).toHaveBeenCalledOnce();
  });

  it.each([
    ["an empty DNS result", []],
    ["mixed public and private DNS results", ["8.8.8.8", "127.0.0.1"]],
  ])(
    "rejects %s before constructing a transport",
    async (_label, addresses) => {
      const dispatcherFactory = vi.fn();
      const client = createSecureSourceClient({
        resolver: async () => addresses,
        dispatcherFactory,
        fetcher: vi.fn(),
      });
      await expect(
        client("https://jobs.example.com/jobs", {
          allowedHosts: ["jobs.example.com"],
          accept: ["application/json"],
          signal: new AbortController().signal,
        }),
      ).rejects.toMatchObject({ code: "unsafe_source_url" });
      expect(dispatcherFactory).not.toHaveBeenCalled();
    },
  );

  it("pins and closes an independent transport for every redirect hop", async () => {
    const closes = [vi.fn(async () => undefined), vi.fn(async () => undefined)];
    const dispatchers = [{}, {}];
    const dispatcherFactory = vi.fn((hostname: string) => {
      const index = hostname === "jobs.example.com" ? 0 : 1;
      return {
        dispatcher: dispatchers[index] as never,
        close: closes[index],
      };
    });
    let requestCount = 0;
    const client = createSecureSourceClient({
      resolver: async (hostname) =>
        hostname === "jobs.example.com" ? ["8.8.8.8"] : ["1.1.1.1"],
      dispatcherFactory,
      fetcher: async (_url, init) => {
        const index = requestCount++;
        expect(init?.dispatcher).toBe(dispatchers[index]);
        return index === 0
          ? new Response(null, {
              status: 302,
              headers: { location: "https://cdn.example.com/jobs" },
            })
          : new Response("{}", {
              headers: { "content-type": "application/json" },
            });
      },
    });

    await client("https://jobs.example.com/jobs", {
      allowedHosts: ["jobs.example.com", "cdn.example.com"],
      accept: ["application/json"],
      signal: new AbortController().signal,
    });
    expect(dispatcherFactory.mock.calls).toEqual([
      ["jobs.example.com", ["8.8.8.8"]],
      ["cdn.example.com", ["1.1.1.1"]],
    ]);
    expect(closes[0]).toHaveBeenCalledOnce();
    expect(closes[1]).toHaveBeenCalledOnce();
  });

  it("closes the pinned transport after fetch and timeout failures", async () => {
    for (const failure of ["fetch", "timeout"] as const) {
      const close = vi.fn(async () => undefined);
      const client = createSecureSourceClient({
        resolver: async () => ["8.8.8.8"],
        timeoutMs: 1,
        dispatcherFactory: () => ({ dispatcher: {} as never, close }),
        fetcher: async (_url, init) => {
          if (failure === "fetch") throw new Error("network failed");
          return new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () =>
              reject(init.signal?.reason),
            );
          });
        },
      });
      const result = client("https://jobs.example.com/jobs", {
        allowedHosts: ["jobs.example.com"],
        accept: ["application/json"],
        signal: new AbortController().signal,
      });
      if (failure === "fetch") await expect(result).rejects.toThrow();
      else
        await expect(result).rejects.toMatchObject({ code: "source_timeout" });
      expect(close).toHaveBeenCalledOnce();
    }
  });

  it.each([
    [
      "rate limiting",
      new Response(null, { status: 429, headers: { "retry-after": "5" } }),
      "source_rate_limited",
    ],
    [
      "unsupported content",
      new Response("plain", { headers: { "content-type": "text/plain" } }),
      "unsupported_content_type",
    ],
  ])("closes the pinned transport after %s", async (_label, response, code) => {
    const close = vi.fn(async () => undefined);
    const client = createSecureSourceClient({
      resolver: async () => ["8.8.8.8"],
      dispatcherFactory: () => ({ dispatcher: {} as never, close }),
      fetcher: async () => response,
    });
    await expect(
      client("https://jobs.example.com/jobs", {
        allowedHosts: ["jobs.example.com"],
        accept: ["application/json"],
        signal: new AbortController().signal,
      }),
    ).rejects.toMatchObject({ code });
    expect(close).toHaveBeenCalledOnce();
  });

  it("enforces response size and content type", async () => {
    const close = vi.fn(async () => undefined);
    const client = createSecureSourceClient({
      resolver: async () => ["8.8.8.8"],
      maxResponseBytes: 4,
      dispatcherFactory: () => ({ dispatcher: {} as never, close }),
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
    expect(close).toHaveBeenCalledOnce();
  });

  it.each([
    [401, "source_unauthorized"],
    [403, "source_forbidden"],
    [404, "source_not_found"],
    [405, "source_unavailable"],
  ])(
    "classifies HTTP %s before checking the response content type",
    async (status, code) => {
      const client = createSecureSourceClient({
        resolver: async () => ["8.8.8.8"],
        maxAttempts: 1,
        dispatcherFactory: () => ({
          dispatcher: {} as never,
          close: vi.fn(async () => undefined),
        }),
        fetcher: async () =>
          new Response("upstream error", {
            status,
            headers: { "content-type": "text/html" },
          }),
      });
      await expect(
        client("https://jobs.example.com/jobs", {
          allowedHosts: ["jobs.example.com"],
          accept: ["application/json"],
          signal: new AbortController().signal,
        }),
      ).rejects.toMatchObject({
        code,
        message: `Source returned HTTP ${status}`,
      });
    },
  );

  it("retries bounded network and transient HTTP failures with an identifiable user agent", async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error("connection reset"))
      .mockResolvedValueOnce(
        new Response("temporarily unavailable", {
          status: 503,
          headers: { "content-type": "text/html" },
        }),
      )
      .mockResolvedValueOnce(
        new Response("{}", {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    const close = vi.fn(async () => undefined);
    const client = createSecureSourceClient({
      resolver: async () => ["8.8.8.8"],
      maxAttempts: 3,
      retryDelayMs: 0,
      dispatcherFactory: () => ({ dispatcher: {} as never, close }),
      fetcher,
    });

    await expect(
      client("https://jobs.example.com/jobs", {
        allowedHosts: ["jobs.example.com"],
        accept: ["application/json"],
        signal: new AbortController().signal,
      }),
    ).resolves.toMatchObject({ status: 200 });
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls[0]?.[1]?.headers).toMatchObject({
      "User-Agent": expect.stringContaining("JobTrace"),
    });
    expect(close).toHaveBeenCalledTimes(3);
  });
});
