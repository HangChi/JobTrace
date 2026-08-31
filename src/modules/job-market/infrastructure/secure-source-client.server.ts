import "server-only";
import { lookup, resolve4, resolve6 } from "node:dns/promises";
import { isIP } from "node:net";
import { getJobMarketEnv } from "@/shared/config/env";
import { SourceError } from "../application/source-errors";

type Resolver = (hostname: string) => Promise<string[]>;

const PROXY_SAFE_PUBLIC_ATS_HOSTS = new Set([
  "boards-api.greenhouse.io",
  "api.lever.co",
  "api.ashbyhq.com",
  "api.smartrecruiters.com",
  "hr.xiaomi.com",
]);

function ipv4ToNumber(value: string) {
  return (
    value
      .split(".")
      .reduce((result, part) => (result << 8) + Number(part), 0) >>> 0
  );
}

function inV4Range(address: string, network: string, prefix: number) {
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (ipv4ToNumber(address) & mask) === (ipv4ToNumber(network) & mask);
}

export function isSyntheticProxyIp(address: string) {
  return isIP(address) === 4 && inV4Range(address, "198.18.0.0", 15);
}

export function isPublicIp(address: string) {
  if (isIP(address) === 4) {
    return ![
      ["0.0.0.0", 8],
      ["10.0.0.0", 8],
      ["100.64.0.0", 10],
      ["127.0.0.0", 8],
      ["169.254.0.0", 16],
      ["172.16.0.0", 12],
      ["192.0.0.0", 24],
      ["192.0.2.0", 24],
      ["192.168.0.0", 16],
      ["198.18.0.0", 15],
      ["198.51.100.0", 24],
      ["203.0.113.0", 24],
      ["224.0.0.0", 4],
      ["240.0.0.0", 4],
    ].some(([network, prefix]) =>
      inV4Range(address, String(network), Number(prefix)),
    );
  }
  if (isIP(address) === 6) {
    const normalized = address.toLowerCase();
    return !(
      normalized === "::" ||
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      /^fe[89ab]/.test(normalized) ||
      normalized.startsWith("ff") ||
      normalized.startsWith("2001:db8:") ||
      normalized.startsWith("::ffff:127.") ||
      normalized.startsWith("::ffff:10.") ||
      normalized.startsWith("::ffff:192.168.")
    );
  }
  return false;
}

export function validateHttpsUrl(
  value: string,
  allowedHosts: readonly string[],
) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new SourceError("unsafe_source_url", "Source URL is invalid");
  }
  const allowed = new Set(allowedHosts.map((host) => host.toLowerCase()));
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    !allowed.has(url.hostname.toLowerCase())
  ) {
    throw new SourceError(
      "unsafe_source_url",
      "Source URL is outside the approved HTTPS hosts",
    );
  }
  return url;
}

async function defaultResolver(hostname: string) {
  if (isIP(hostname)) return [hostname];
  const [v4, v6] = await Promise.all([
    resolve4(hostname).catch(() => []),
    resolve6(hostname).catch(() => []),
  ]);
  const direct = [...v4, ...v6];
  if (direct.length) return direct;
  const system = await lookup(hostname, { all: true, verbatim: true }).catch(
    () => [],
  );
  return system.map((item) => item.address);
}

async function assertPublicHost(
  url: URL,
  resolver: Resolver,
  allowProxyDns: boolean,
) {
  const addresses = await resolver(url.hostname);
  const valid =
    addresses.length > 0 &&
    addresses.every(
      (address) =>
        isPublicIp(address) ||
        ((allowProxyDns || PROXY_SAFE_PUBLIC_ATS_HOSTS.has(url.hostname)) &&
          isSyntheticProxyIp(address)),
    );
  if (!valid) {
    throw new SourceError(
      "unsafe_source_url",
      "Source host does not resolve exclusively to public addresses",
    );
  }
}

async function limitedBody(response: Response, maxBytes: number) {
  const declared = Number(response.headers.get("content-length") || "0");
  if (declared > maxBytes)
    throw new SourceError("response_too_large", "Source response is too large");
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new SourceError(
        "response_too_large",
        "Source response is too large",
      );
    }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export function createSecureSourceClient(options?: {
  resolver?: Resolver;
  fetcher?: typeof fetch;
  timeoutMs?: number;
  maxResponseBytes?: number;
  allowProxyDns?: boolean;
}) {
  const env = getJobMarketEnv();
  const resolver = options?.resolver ?? defaultResolver;
  const fetcher = options?.fetcher ?? fetch;
  const timeoutMs = options?.timeoutMs ?? env.fetchTimeoutMs;
  const maxResponseBytes = options?.maxResponseBytes ?? env.maxResponseBytes;
  const allowProxyDns = options?.allowProxyDns ?? env.allowProxyDns;

  return async function secureFetch(
    value: string,
    request: {
      allowedHosts: string[];
      signal: AbortSignal;
      headers?: Record<string, string>;
      accept: readonly string[];
    },
  ) {
    let url = validateHttpsUrl(value, request.allowedHosts);
    const timeout = AbortSignal.timeout(timeoutMs);
    const signal = AbortSignal.any([request.signal, timeout]);
    for (let redirects = 0; redirects <= 3; redirects += 1) {
      await assertPublicHost(url, resolver, allowProxyDns);
      let response: Response;
      try {
        response = await fetcher(url, {
          redirect: "manual",
          signal,
          headers: { Accept: request.accept.join(", "), ...request.headers },
        });
      } catch (error) {
        if (signal.aborted)
          throw new SourceError("source_timeout", "Source request timed out");
        throw error;
      }
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location || redirects === 3)
          throw new SourceError(
            "unsafe_source_url",
            "Source redirect limit exceeded",
          );
        url = validateHttpsUrl(
          new URL(location, url).href,
          request.allowedHosts,
        );
        continue;
      }
      if (response.status === 429) {
        const retry = Number(response.headers.get("retry-after") || "0");
        throw new SourceError(
          "source_rate_limited",
          "Source rate limit reached",
          Number.isFinite(retry) ? retry : undefined,
        );
      }
      const contentType =
        response.headers.get("content-type")?.split(";")[0] ?? "";
      if (!request.accept.some((accepted) => contentType === accepted))
        throw new SourceError(
          "unsupported_content_type",
          "Source returned an unsupported content type",
        );
      const body = await limitedBody(response, maxResponseBytes);
      const text = new TextDecoder().decode(body);
      return {
        status: response.status,
        headers: response.headers,
        async text() {
          return text;
        },
        async json() {
          try {
            return JSON.parse(text) as unknown;
          } catch {
            throw new SourceError(
              "invalid_source_payload",
              "Source JSON is invalid",
            );
          }
        },
      };
    }
    throw new SourceError(
      "unsafe_source_url",
      "Source redirect limit exceeded",
    );
  };
}
