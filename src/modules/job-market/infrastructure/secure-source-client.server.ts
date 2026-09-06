import "server-only";
import { lookup, resolve4, resolve6 } from "node:dns/promises";
import { isIP, type LookupFunction } from "node:net";
import { Agent, type Dispatcher } from "undici";
import { getJobMarketEnv } from "@/shared/config/env";
import { SourceError } from "../application/source-errors";

type Resolver = (hostname: string) => Promise<string[]>;
type DispatcherRequestInit = RequestInit & { dispatcher?: Dispatcher };
type SourceFetcher = (
  input: string | URL,
  init?: DispatcherRequestInit,
) => Promise<Response>;
type ManagedDispatcher = {
  dispatcher: Dispatcher;
  close: () => Promise<void>;
};
type DispatcherFactory = (
  hostname: string,
  addresses: readonly string[],
) => ManagedDispatcher;

const PROXY_SAFE_PUBLIC_ATS_HOSTS = new Set([
  "boards-api.greenhouse.io",
  "api.lever.co",
  "api.ashbyhq.com",
  "api.smartrecruiters.com",
  "api.mokahr.com",
  "hr.xiaomi.com",
]);

function isProxySafePublicAtsHost(hostname: string) {
  return (
    PROXY_SAFE_PUBLIC_ATS_HOSTS.has(hostname) ||
    hostname.endsWith(".jobs.feishu.cn") ||
    hostname.endsWith(".zhiye.com") ||
    hostname.endsWith(".hotjob.cn") ||
    hostname.endsWith(".myworkdayjobs.com") ||
    hostname === "campus.51job.com" ||
    [
      "careers.tencent.com",
      "talent.baidu.com",
      "talent.alibaba.com",
      "campus.jd.com",
      "zhaopin.meituan.com",
      "jobs.bytedance.com",
      "apigw-dgg-b0.huawei.com",
      "hr.163.com",
      "ats.openout.mihoyo.com",
      "job.dahuatech.com",
    ].includes(hostname)
  );
}

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

const RESERVED_V4_RANGES: Array<[string, number]> = [
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
];

function isPublicIpv4(address: string) {
  return !RESERVED_V4_RANGES.some(([network, prefix]) =>
    inV4Range(address, network, prefix),
  );
}

function mappedIpv4Address(address: string) {
  let normalized = address.toLowerCase();
  const dottedTail = normalized.slice(normalized.lastIndexOf(":") + 1);
  if (dottedTail.includes(".")) {
    if (isIP(dottedTail) !== 4) return null;
    const bytes = dottedTail.split(".").map(Number);
    const high = ((bytes[0] << 8) | bytes[1]).toString(16);
    const low = ((bytes[2] << 8) | bytes[3]).toString(16);
    normalized = `${normalized.slice(0, normalized.lastIndexOf(":") + 1)}${high}:${low}`;
  }

  const halves = normalized.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves[1] ? halves[1].split(":") : [];
  const omitted = halves.length === 2 ? 8 - left.length - right.length : 0;
  const parts = [
    ...left,
    ...Array.from({ length: omitted }, () => "0"),
    ...right,
  ].map((part) => Number.parseInt(part, 16));
  if (
    parts.length !== 8 ||
    !parts.slice(0, 5).every((part) => part === 0) ||
    parts[5] !== 0xffff
  )
    return null;
  return [parts[6] >> 8, parts[6] & 0xff, parts[7] >> 8, parts[7] & 0xff].join(
    ".",
  );
}

export function isPublicIp(address: string) {
  if (isIP(address) === 4) {
    return isPublicIpv4(address);
  }
  if (isIP(address) === 6) {
    const normalized = address.toLowerCase();
    // DNS may return mapped addresses in dotted or compressed hexadecimal
    // form. Always apply the IPv4 policy to the embedded address.
    const mapped = mappedIpv4Address(normalized);
    if (mapped) return isPublicIpv4(mapped);
    return !(
      normalized === "::" ||
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      /^fe[89ab]/.test(normalized) ||
      normalized.startsWith("ff") ||
      normalized.startsWith("2001:db8:")
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

async function resolvePublicHost(
  url: URL,
  resolver: Resolver,
  allowProxyDns: boolean,
) {
  const addresses = [...new Set(await resolver(url.hostname))];
  const valid =
    addresses.length > 0 &&
    addresses.every(
      (address) =>
        isPublicIp(address) ||
        ((allowProxyDns || isProxySafePublicAtsHost(url.hostname)) &&
          isSyntheticProxyIp(address)),
    );
  if (!valid) {
    throw new SourceError(
      "unsafe_source_url",
      "Source host does not resolve exclusively to public addresses",
    );
  }
  return addresses;
}

export function createPinnedLookup(
  expectedHostname: string,
  addresses: readonly string[],
): LookupFunction {
  const records = addresses.map((address) => ({
    address,
    family: isIP(address) as 4 | 6,
  }));
  const expected = expectedHostname.toLowerCase();

  return (hostname, options, callback) => {
    const requestedFamily =
      options.family === "IPv4"
        ? 4
        : options.family === "IPv6"
          ? 6
          : options.family;
    const candidates = requestedFamily
      ? records.filter((record) => record.family === requestedFamily)
      : records;
    if (hostname.toLowerCase() !== expected || candidates.length === 0) {
      const error = Object.assign(new Error("Pinned DNS lookup rejected"), {
        code: "ENOTFOUND",
      });
      callback(error, options.all ? [] : "", 0);
      return;
    }
    if (options.all) {
      callback(null, candidates);
      return;
    }
    callback(null, candidates[0].address, candidates[0].family);
  };
}

function createPinnedDispatcher(
  hostname: string,
  addresses: readonly string[],
): ManagedDispatcher {
  // The transport must consume this validated set instead of resolving again.
  const agent = new Agent({
    connect: { lookup: createPinnedLookup(hostname, addresses) },
  });
  return { dispatcher: agent, close: () => agent.close() };
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
  fetcher?: SourceFetcher;
  dispatcherFactory?: DispatcherFactory;
  timeoutMs?: number;
  maxResponseBytes?: number;
  allowProxyDns?: boolean;
}) {
  const env = getJobMarketEnv();
  const resolver = options?.resolver ?? defaultResolver;
  const fetcher = options?.fetcher ?? fetch;
  const dispatcherFactory =
    options?.dispatcherFactory ?? createPinnedDispatcher;
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
      method?: "GET" | "POST";
      body?: string;
    },
  ) {
    let url = validateHttpsUrl(value, request.allowedHosts);
    const timeout = AbortSignal.timeout(timeoutMs);
    const signal = AbortSignal.any([request.signal, timeout]);
    for (let redirects = 0; redirects <= 3; redirects += 1) {
      const addresses = await resolvePublicHost(url, resolver, allowProxyDns);
      const transport = dispatcherFactory(url.hostname, addresses);
      let response: Response | undefined;
      try {
        response = await fetcher(url, {
          dispatcher: transport.dispatcher,
          redirect: "manual",
          signal,
          method: request.method,
          body: request.body,
          headers: { Accept: request.accept.join(", "), ...request.headers },
        });
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
      } catch (error) {
        if (signal.aborted)
          throw new SourceError("source_timeout", "Source request timed out");
        throw error;
      } finally {
        if (response?.body && !response.bodyUsed) {
          await response.body.cancel().catch(() => undefined);
        }
        await transport.close().catch(() => undefined);
      }
    }
    throw new SourceError(
      "unsafe_source_url",
      "Source redirect limit exceeded",
    );
  };
}
