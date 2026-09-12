import { readFile } from "node:fs/promises";
import process from "node:process";import { MokaAdapter } from "../src/modules/job-market/infrastructure/adapters/moka-adapter";
import { BeisenAdapter } from "../src/modules/job-market/infrastructure/adapters/beisen-adapter";
import { GreenhouseAdapter } from "../src/modules/job-market/infrastructure/adapters/greenhouse-adapter";
import { LeverAdapter } from "../src/modules/job-market/infrastructure/adapters/lever-adapter";
import { SmartRecruitersAdapter } from "../src/modules/job-market/infrastructure/adapters/smartrecruiters-adapter";
import { WorkdayAdapter } from "../src/modules/job-market/infrastructure/adapters/workday-adapter";
import {
  DayeeAdapter,
  Job51Adapter,
} from "../src/modules/job-market/infrastructure/adapters/html-list-adapter";
import { ChinaBigTechAdapter } from "../src/modules/job-market/infrastructure/adapters/china-bigtech-adapter";
import type { SecureSourceFetch } from "../src/modules/job-market/application/ports";
import type { SourceAdapter } from "../src/modules/job-market/application/ports";
import type { JobMarketSource } from "../src/modules/job-market/domain/entities";

const sample = parseInt(process.argv[2] ?? "0", 10); // 0 = 全量
const retryDelayMs = 1500;

// 与 secure-source-client 同样的 host 校验语义，但不依赖 server-only 运行时。
const fetcher: SecureSourceFetch = async (url, options) => {
  const target = new URL(url);
  if (
    !options.allowedHosts.some(
      (host) =>
        target.hostname === host ||
        target.hostname.endsWith(`.${host}`) ||
        options.allowedHosts.includes("*"),
    )
  )
    throw new Error(`host not allowed: ${target.hostname}`);
  const response = await fetch(url, {
    method: options.method ?? "GET",
    body: options.body,
    headers: {
      accept: options.accept.join(", "),
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      ...(options.headers ?? {}),
    },
    signal: options.signal,
  });
  return {
    status: response.status,
    headers: response.headers,
    text: () => response.text(),
    json: () => response.json(),
  };
};

const additions = JSON.parse(
  await readFile(
    "src/modules/job-market/application/researched-source-additions.json",
    "utf8",
  ),
) as Array<Record<string, unknown>>;

const byAdapterKinds = new Set(additions.map((entry) => String(entry.adapter)));

const adapters = new Map<string, SourceAdapter>(
  (
    [
      ["moka", new MokaAdapter(fetcher)],
      ["beisen", new BeisenAdapter(fetcher)],
      ["greenhouse", new GreenhouseAdapter(fetcher)],
      ["lever", new LeverAdapter(fetcher)],
      ["smartrecruiters", new SmartRecruitersAdapter(fetcher)],
      ["dayee", new DayeeAdapter(fetcher)],
      ["workday", new WorkdayAdapter(fetcher)],
      ["job51", new Job51Adapter(fetcher)],
      ["china_bigtech", new ChinaBigTechAdapter(fetcher)],
    ] as Array<[string, SourceAdapter]>
  ).filter(([kind]) => byAdapterKinds.has(kind)),
);

const byAdapter = new Map<string, Array<Record<string, unknown>>>();
for (const entry of additions) {
  const adapter = String(entry.adapter);
  if (!adapters.has(adapter)) continue;
  byAdapter.set(adapter, [...(byAdapter.get(adapter) ?? []), entry]);
}

let ok = 0;
let failed = 0;
const failures: Array<{ identityKey: string; company: string; error: string }> =
  [];
const testedKeys = new Set<string>();

async function testEntry(
  adapterKind: string,
  adapter: SourceAdapter,
  entry: Record<string, unknown>,
): Promise<void> {
  const source: JobMarketSource = {
    id: `smoke-${entry.identityKey}`,
    companyId: "smoke",
    companyName: String(entry.companyName),
    adapter: adapterKind as JobMarketSource["adapter"],
    externalKey: String(entry.externalKey),
    baseUrl: String(entry.baseUrl),
    allowedHosts: entry.allowedHosts as string[],
    countryCodes: ["cn"],
    isOfficial: true,
    accessBasis: "public",
    status: "active",
    syncIntervalMinutes: 360,
    consecutiveFailures: 0,
    etag: null,
    lastModified: null,
  };
  const run = () =>
    adapter.fetch(
      source,
      { runId: `smoke-${Date.now()}`, now: new Date(), maxItems: 200 },
      AbortSignal.timeout(30000),
    );
  testedKeys.add(String(entry.identityKey));
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const batch = await run();
      const first = batch.jobs?.[0];
      console.log(
        `OK   ${String(entry.companyName)} [${adapterKind}] jobs=${batch.jobs.length} rejected=${batch.rejected.length}` +
          (first ? ` e.g. ${first.title}` : ""),
      );
      ok++;
      return;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      if (attempt === 1) {
        console.log(
          `FAIL ${String(entry.companyName)} [${adapterKind}]: ${message}`,
        );
        failures.push({
          identityKey: String(entry.identityKey),
          company: String(entry.companyName),
          error: message,
        });
        failed++;
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }
}

const tasks: Array<() => Promise<void>> = [];
for (const [adapterKind, entries] of byAdapter) {
  const picks = sample > 0 ? entries.slice(0, sample) : entries;
  const adapter = adapters.get(adapterKind)!;
  for (const entry of picks)
    tasks.push(() => testEntry(adapterKind, adapter, entry));
}
let cursor = 0;
await Promise.all(
  Array.from({ length: 6 }, async () => {
    while (cursor < tasks.length) await tasks[cursor++]();
  }),
);

const { writeFile, mkdir } = await import("node:fs/promises");
await mkdir("tmp/company-research", { recursive: true });
const failuresPath = "tmp/company-research/smoke-failures.json";
// 失败清单累积保留：生成器会剔除已失败的来源，下一轮冒烟不再复测它们，
// 若每次覆盖重写，先前被剔除的来源会在再生成时被错误地加回。
const previousFailures = JSON.parse(
  (await readFile(failuresPath).catch(() => "[]")) as string,
) as typeof failures;
const failuresByKey = new Map(
  previousFailures.map((item) => [item.identityKey, item]),
);
for (const failure of failures) failuresByKey.set(failure.identityKey, failure);
for (const identityKey of testedKeys)
  if (!failures.some((failure) => failure.identityKey === identityKey))
    failuresByKey.delete(identityKey);
await writeFile(
  failuresPath,
  `${JSON.stringify([...failuresByKey.values()], null, 1)}\n`,
);
console.log(`\nsmoke result: ok=${ok} failed=${failed}`);
if (failures.length) console.log("failures written to tmp/company-research/smoke-failures.json");
