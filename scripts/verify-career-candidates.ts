import { readdir, readFile, writeFile } from "node:fs/promises";
import { detectSourceCandidate } from "../src/modules/job-market/application/source-discovery";

const resultsDir = "tmp/company-research/results";
const outputPath = "tmp/company-research/verified.json";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome 126.0.0.0 Safari/537.36";

type CandidateCompany = {
  company: string;
  companyType?: string;
  industry?: string;
  candidates: string[];
  status?: string;
};

type VerifiedUrl = {
  url: string;
  finalUrl: string;
  httpStatus: number | null;
  error?: string;
  detected: ReturnType<typeof detectSourceCandidate>;
  kind: "high" | "medium" | "unrecognized" | "unreachable";
};

type VerifiedCompany = CandidateCompany & {
  verified: VerifiedUrl[];
  best: VerifiedUrl | null;
};

function isSafeUrl(raw: string) {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return false;
    if (url.username || url.password) return false;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".local")) return false;
    if (/^(10|127)\./.test(host)) return false;
    if (/^192\.168\./.test(host)) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

function classify(detected: VerifiedUrl["detected"]): VerifiedUrl["kind"] {
  if (!detected) return "unrecognized";
  return detected.confidence === "high" ? "high" : "medium";
}

async function inspect(url: string): Promise<VerifiedUrl> {
  const base: VerifiedUrl = {
    url,
    finalUrl: url,
    httpStatus: null,
    detected: null,
    kind: "unreachable",
  };
  try {
    // 手动跟随重定向：部分招聘板（如 app.mokahr.com）存在 SPA 重定向循环，
    // fetch 默认策略会直接抛错；这里最多跟 5 跳并记录最终 URL。
    let current = url;
    let response: Response | null = null;
    const visited = new Set([url]);
    for (let hop = 0; hop < 6; hop++) {
      response = await fetch(current, {
        redirect: "manual",
        signal: AbortSignal.timeout(25000),
        headers: {
          "user-agent": USER_AGENT,
          accept: "text/html,application/xhtml+xml",
          "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
        },
      });
      const location = response.headers.get("location");
      if (
        [301, 302, 303, 307, 308].includes(response.status) &&
        location
      ) {
        const next = new URL(location, current).href;
        if (new URL(next).protocol !== "https:") {
          base.finalUrl = current;
          base.error = "redirect_to_http";
          break;
        }
        if (visited.has(next)) {
          base.finalUrl = next;
          base.error = "redirect_loop";
          break;
        }
        visited.add(next);
        current = next;
        continue;
      }
      base.finalUrl = current;
      break;
    }
    if (response) {
      base.httpStatus = response.status;
      if (response.status >= 200 && response.status < 400) {
        const html = await response.text().catch(() => "");
        base.detected = detectSourceCandidate(
          base.finalUrl,
          html.slice(0, 500000),
        );
        base.kind = classify(base.detected);
        return base;
      }
      base.error = base.error ?? `http_${response.status}`;
    }
  } catch (error) {
    base.error = error instanceof Error ? error.name : "fetch_failed";
  }
  // 抓取失败时回退到纯 URL 模式判定：已知 ATS 域名（moka/zhiye 等）的看板
  // 链接无需页面 HTML 即可判定，实际同步走 ATS API，不受页面可达性影响。
  base.detected = detectSourceCandidate(base.finalUrl) ?? null;
  if (base.detected) base.kind = classify(base.detected);
  return base;
}

const files = (await readdir(resultsDir)).filter((file) =>
  file.endsWith(".json"),
);
const byCompany = new Map<string, CandidateCompany>();
for (const file of files) {
  const parsed = JSON.parse(
    await readFile(`${resultsDir}/${file}`, "utf8"),
  ) as CandidateCompany[];
  for (const item of parsed) {
    if (!Array.isArray(item.candidates) || item.candidates.length === 0)
      continue;
    const existing = byCompany.get(item.company);
    if (existing)
      existing.candidates = [
        ...existing.candidates,
        ...item.candidates.filter((url) => !existing.candidates.includes(url)),
      ];
    else byCompany.set(item.company, { ...item, candidates: [...item.candidates] });
  }
}

const companies = [...byCompany.values()];
console.log(
  `companies with candidates: ${companies.length}, urls: ${companies.reduce(
    (sum, item) => sum + item.candidates.length,
    0,
  )}`,
);

const rank = (kind: VerifiedUrl["kind"]) =>
  ({ high: 0, medium: 1, unrecognized: 2, unreachable: 3 })[kind];

const verified: VerifiedCompany[] = [];
const queue = companies.flatMap((company) =>
  company.candidates.filter(isSafeUrl).map((url) => ({ company, url })),
);
let cursor = 0;
const workers = Array.from({ length: 6 }, async () => {
  while (cursor < queue.length) {
    const item = queue[cursor++];
    const result = await inspect(item.url);
    const entry = verified.find(
      (candidate) => candidate.company === item.company.company,
    );
    if (entry) entry.verified.push(result);
    else
      verified.push({
        ...item.company,
        verified: [result],
        best: null,
      });
  }
});
await Promise.all(workers);

for (const company of verified) {
  company.verified.sort((left, right) => rank(left.kind) - rank(right.kind));
  company.best = company.verified[0] ?? null;
}

const summary = verified.reduce(
  (acc, company) => {
    acc[company.best?.kind ?? "no_candidate"]++;
    return acc;
  },
  { high: 0, medium: 0, unrecognized: 0, unreachable: 0, no_candidate: 0 } as Record<string, number>,
);
console.log("summary:", summary);

await writeFile(outputPath, `${JSON.stringify(verified, null, 1)}\n`);
console.log(`written: ${outputPath}`);
