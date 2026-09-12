import type { SecureSourceFetch } from "./ports";
import { detectSourceCandidate } from "./source-discovery";
import { searchWeb, type WebSearchResult } from "./company-website-research";
import { extractCompanyFromTitle } from "./wechat-article-collector";

// A 方案 site: 枚举扫描：用公开搜索引擎的 site: 查询枚举 ATS 托管的招聘板
// （含无公开目录的 Moka/北森）。结果 URL 即招聘板地址，模式判定即为高置信
// ATS 来源；公司名从结果标题提取。

export const DEFAULT_SITE_SCAN_QUERIES = [
  "site:app.mokahr.com 招聘",
  "site:jobs.smartrecruiters.com 招聘",
  "site:job-boards.greenhouse.io 招聘",
  "site:jobs.lever.co 招聘",
  "site:zhiye.com 社会招聘",
] as const;

export type BoardHit = {
  companyName: string;
  boardUrl: string;
  articleTitle: string;
  detected: NonNullable<ReturnType<typeof detectSourceCandidate>>;
};

export function extractBoardHits(results: WebSearchResult[]): {
  hits: BoardHit[];
  skipped: number;
} {
  const hits: BoardHit[] = [];
  const seenBoards = new Set<string>();
  let skipped = 0;
  for (const result of results) {
    const detected = detectSourceCandidate(result.url);
    if (!detected || detected.confidence !== "high") {
      skipped += 1;
      continue;
    }
    const boardKey = `${detected.adapter}|${detected.externalKey}`;
    if (seenBoards.has(boardKey)) {
      skipped += 1;
      continue;
    }
    const companyName = extractCompanyFromTitle(result.title);
    if (!companyName) {
      skipped += 1;
      continue;
    }
    seenBoards.add(boardKey);
    hits.push({
      companyName,
      boardUrl: result.url,
      articleTitle: result.title,
      detected,
    });
  }
  return { hits, skipped };
}

export async function scanAtsBoards(
  queries: readonly string[],
  dependencies: {
    fetcher: SecureSourceFetch;
    onQuery?: (current: number, total: number, query: string) => void;
  },
) {
  const hits: BoardHit[] = [];
  const skipped: number[] = [];
  for (const [index, query] of queries.entries()) {
    dependencies.onQuery?.(index + 1, queries.length, query);
    if (index > 0)
      await new Promise((resolve) =>
        setTimeout(resolve, 1500 + Math.random() * 1500),
      );
    const results = await searchWeb(query, dependencies.fetcher);
    const extracted = extractBoardHits(results);
    hits.push(...extracted.hits);
    skipped.push(extracted.skipped);
  }
  return { hits, skipped: skipped.reduce((sum, item) => sum + item, 0) };
}
