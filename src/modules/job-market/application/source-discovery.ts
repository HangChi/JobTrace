import { load } from "cheerio";
import type { SourceAdapterKind } from "../domain/entities";
import type { SecureSourceFetch } from "./ports";
import { safeSourceError } from "./source-errors";

export type DetectedSourceCandidate = {
  adapter: SourceAdapterKind;
  externalKey: string;
  baseUrl: string;
  allowedHosts: string[];
  confidence: "high" | "medium";
  evidenceCode: string;
};

export type DiscoveryTarget = {
  companyId: string;
  companyName: string;
  entryUrl: string;
};

export type DiscoveryObservation = {
  target: DiscoveryTarget;
  detected: DetectedSourceCandidate | null;
  healthStatus: "healthy" | "unreachable" | "unsupported";
  evidenceCode: string;
  diagnosticCode?: string;
  diagnosticSummary?: string;
  httpStatus?: number;
};

export type DiscoveryRepository = {
  listTargets(limit: number): Promise<DiscoveryTarget[]>;
  record(observation: DiscoveryObservation): Promise<void>;
};

function pathParts(url: URL) {
  return url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
}

function directCandidate(value: string): DetectedSourceCandidate | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  const parts = pathParts(url);
  const result = (
    adapter: SourceAdapterKind,
    externalKey: string | undefined,
    baseUrl: string,
    allowedHost: string,
    evidenceCode: string,
  ) =>
    externalKey
      ? {
          adapter,
          externalKey: externalKey.slice(0, 200),
          baseUrl,
          allowedHosts: [allowedHost],
          confidence: "high" as const,
          evidenceCode,
        }
      : null;

  if (["boards.greenhouse.io", "job-boards.greenhouse.io"].includes(host))
    return result(
      "greenhouse",
      parts[0],
      "https://boards-api.greenhouse.io/",
      "boards-api.greenhouse.io",
      "known_greenhouse_url",
    );
  if (host === "jobs.lever.co")
    return result(
      "lever",
      parts[0],
      "https://api.lever.co/",
      "api.lever.co",
      "known_lever_url",
    );
  if (host === "jobs.ashbyhq.com")
    return result(
      "ashby",
      parts[0],
      "https://api.ashbyhq.com/",
      "api.ashbyhq.com",
      "known_ashby_url",
    );
  if (host === "jobs.smartrecruiters.com")
    return result(
      "smartrecruiters",
      parts[0],
      "https://api.smartrecruiters.com/",
      "api.smartrecruiters.com",
      "known_smartrecruiters_url",
    );
  if (host === "app.mokahr.com") {
    const portal = parts[0];
    const mode = portal === "campus-recruitment" ? "campus" : "social";
    if (!["campus-recruitment", "social-recruitment"].includes(portal ?? ""))
      return null;
    return result(
      "moka",
      parts[1] ? `${parts[1]}|${mode}|${parts[2] ?? ""}` : undefined,
      "https://api.mokahr.com/",
      "api.mokahr.com",
      "known_moka_url",
    );
  }
  if (host === "hr.xiaomi.com")
    return result(
      "xiaomi",
      "domestic",
      "https://hr.xiaomi.com/website/",
      "hr.xiaomi.com",
      "known_xiaomi_url",
    );
  return null;
}

function containsJobPosting(html: string) {
  const $ = load(html);
  let found = false;
  $('script[type="application/ld+json"]').each((_index, element) => {
    try {
      const value = JSON.parse($(element).text()) as unknown;
      const visit = (item: unknown): boolean => {
        if (Array.isArray(item)) return item.some(visit);
        if (!item || typeof item !== "object") return false;
        const record = item as Record<string, unknown>;
        const types = Array.isArray(record["@type"])
          ? record["@type"]
          : [record["@type"]];
        return (
          types.includes("JobPosting") ||
          (Array.isArray(record["@graph"]) && record["@graph"].some(visit))
        );
      };
      if (visit(value)) found = true;
    } catch {
      // Malformed JSON-LD is isolated and never executed.
    }
  });
  return found;
}

export function detectSourceCandidate(
  entryUrl: string,
  html?: string,
): DetectedSourceCandidate | null {
  const direct = directCandidate(entryUrl);
  if (direct) return direct;
  if (!html) return null;
  const $ = load(html);
  for (const href of $("a[href]")
    .map((_index, element) => $(element).attr("href"))
    .get()) {
    try {
      const linked = directCandidate(new URL(href, entryUrl).href);
      if (linked) return linked;
    } catch {
      // Ignore invalid links from external pages.
    }
  }
  if (!containsJobPosting(html)) return null;
  try {
    const url = new URL(entryUrl);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return {
      adapter: "schema_org",
      externalKey: `schema:${url.hostname}${url.pathname}`.slice(0, 200),
      baseUrl: url.href,
      allowedHosts: [url.hostname.toLowerCase()],
      confidence: "medium",
      evidenceCode: "jobposting_jsonld",
    };
  } catch {
    return null;
  }
}

async function inspectTarget(
  target: DiscoveryTarget,
  fetcher: SecureSourceFetch,
): Promise<DiscoveryObservation> {
  let entry: URL;
  try {
    entry = new URL(target.entryUrl);
    if (entry.protocol !== "https:" || entry.username || entry.password)
      throw new Error("unsafe");
  } catch {
    return {
      target,
      detected: null,
      healthStatus: "unsupported",
      evidenceCode: "invalid_directory_url",
      diagnosticCode: "unsafe_source_url",
      diagnosticSummary: "目录入口不是安全的 HTTPS 地址。",
    };
  }

  try {
    const response = await fetcher(entry.href, {
      allowedHosts: [entry.hostname.toLowerCase()],
      signal: new AbortController().signal,
      accept: ["text/html", "application/xhtml+xml"],
    });
    if (response.status < 200 || response.status >= 400)
      return {
        target,
        detected: null,
        healthStatus: "unreachable",
        evidenceCode: "http_error",
        diagnosticCode: "source_http_error",
        diagnosticSummary: `招聘入口返回 HTTP ${response.status}。`,
        httpStatus: response.status,
      };
    const detected = detectSourceCandidate(entry.href, await response.text());
    return {
      target,
      detected,
      healthStatus: "healthy",
      evidenceCode: detected?.evidenceCode ?? "no_supported_source",
      diagnosticCode: detected ? undefined : "source_not_recognized",
      diagnosticSummary: detected
        ? undefined
        : "页面可访问，但尚未识别到受支持的公开招聘数据源。",
      httpStatus: response.status,
    };
  } catch (error) {
    const safe = safeSourceError(error);
    return {
      target,
      detected: null,
      healthStatus: "unreachable",
      evidenceCode: "fetch_failed",
      diagnosticCode: safe.code,
      diagnosticSummary: safe.summary,
    };
  }
}

export async function scanDiscoveryTargets(
  limit: number,
  dependencies: {
    repository: DiscoveryRepository;
    fetcher: SecureSourceFetch;
  },
) {
  const targets = await dependencies.repository.listTargets(limit);
  const observations: DiscoveryObservation[] = [];
  for (let offset = 0; offset < targets.length; offset += 3) {
    observations.push(
      ...(await Promise.all(
        targets
          .slice(offset, offset + 3)
          .map((target) => inspectTarget(target, dependencies.fetcher)),
      )),
    );
  }
  for (const observation of observations)
    await dependencies.repository.record(observation);
  return {
    scanned: observations.length,
    recognized: observations.filter((item) => item.detected).length,
    healthy: observations.filter((item) => item.healthStatus === "healthy")
      .length,
    unreachable: observations.filter(
      (item) => item.healthStatus === "unreachable",
    ).length,
  };
}
