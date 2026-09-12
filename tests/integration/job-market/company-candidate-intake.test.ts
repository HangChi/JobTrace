import { test, expect } from "@playwright/test";
import { testDatabase, testId } from "../../setup/database";
import { PostgresCompanyCandidateRepository } from "@/modules/job-market/infrastructure/postgres-company-candidate-repository";
import { PostgresSyncRepository } from "@/modules/job-market/infrastructure/postgres-sync-repository";
import { normalizeText } from "@/modules/job-market/domain/normalization";

function siteScanHit(overrides: {
  companyName: string;
  boardUrl: string;
  externalKey: string;
}) {
  return {
    companyName: overrides.companyName,
    boardUrl: overrides.boardUrl,
    articleTitle: `${overrides.companyName} 正在招聘各类岗位`,
    detected: {
      adapter: "greenhouse",
      externalKey: overrides.externalKey,
      baseUrl: "https://boards.example.com/",
      allowedHosts: ["boards.example.com"],
      confidence: "high" as const,
    },
  };
}

test("enqueueSiteScan records boards, queues candidates and dedupes batches atomically", async () => {
  const sql = testDatabase();
  const tag = testId("scan");
  const knownName = `站测科技${tag}`;
  const newName = `星箭网络${tag}`;
  const duplicateSourceName = `云杉智能${tag}`;
  const [knownCompany] = await sql<Array<{ id: string }>>`
    insert into job_market_companies(
      canonical_name,normalized_name,company_type,industry,identity_key)
    values(${knownName},${normalizeText(knownName)},'民营企业','互联网',${testId("company")})
    returning id`;

  const syncRepository = new PostgresSyncRepository();
  const existingExternalKey = testId("dup-source");
  const [sourceOwner] = await sql<Array<{ id: string }>>`
    insert into job_market_companies(
      canonical_name,normalized_name,company_type,industry,identity_key)
    values(${`既有来源${tag}`},${normalizeText(`既有来源${tag}`)},'民营企业','互联网',${testId("company")})
    returning id`;
  const sourceId = await syncRepository.createSource({
    companyId: sourceOwner.id,
    adapter: "greenhouse",
    externalKey: existingExternalKey,
    baseUrl: "https://boards.example.com/",
    allowedHosts: ["boards.example.com"],
    countryCodes: [],
    accessBasis: "public",
    isOfficial: true,
    syncIntervalMinutes: 360,
  });

  const repository = new PostgresCompanyCandidateRepository();
  try {
    const batch = [
      siteScanHit({
        companyName: knownName,
        boardUrl: "https://boards.example.com/known/jobs",
        externalKey: "known-board",
      }),
      siteScanHit({
        companyName: knownName,
        boardUrl: "https://boards.example.com/known/jobs",
        externalKey: "known-board",
      }),
      siteScanHit({
        companyName: knownName,
        boardUrl: "https://boards.example.com/known/other-jobs",
        externalKey: "known-board-2",
      }),
      siteScanHit({
        companyName: newName,
        boardUrl: "https://boards.example.com/new/jobs",
        externalKey: testId("new-board"),
      }),
      siteScanHit({
        companyName: newName,
        boardUrl: "https://boards.example.com/new/jobs",
        externalKey: testId("new-board"),
      }),
      siteScanHit({
        companyName: duplicateSourceName,
        boardUrl: "https://boards.example.com/dup/jobs",
        externalKey: existingExternalKey,
      }),
    ];
    const result = await repository.enqueueSiteScan(batch);
    expect(result).toEqual({ known: 2, queued: 1, existingSources: 1 });

    const boards = await sql<
      Array<{ entryUrl: string; adapter: string; reviewStatus: string }>
    >`
      select entry_url as "entryUrl",adapter::text as "adapter",
        review_status::text as "reviewStatus"
      from job_market_source_candidates where company_id=${knownCompany.id}
      order by entry_url`;
    expect(boards).toEqual([
      {
        entryUrl: "https://boards.example.com/known/jobs",
        adapter: "greenhouse",
        reviewStatus: "pending",
      },
      {
        entryUrl: "https://boards.example.com/known/other-jobs",
        adapter: "greenhouse",
        reviewStatus: "pending",
      },
    ]);

    const [candidate] = await sql<
      Array<{
        companyName: string;
        sourceEngine: string;
        articleCount: number;
        detectedExternalKey: string;
      }>
    >`
      select company_name as "companyName",source_engine::text as "sourceEngine",
        article_count as "articleCount",
        detected_external_key as "detectedExternalKey"
      from job_market_company_candidates
      where normalized_name=${normalizeText(newName)}`;
    expect(candidate).toMatchObject({
      companyName: newName,
      sourceEngine: "site_scan",
      articleCount: 1,
    });
    expect(candidate!.detectedExternalKey).toBeTruthy();

    const duplicates = await sql<Array<{ id: string }>>`
      select id from job_market_company_candidates
      where normalized_name in (${normalizeText(duplicateSourceName)}, ${normalizeText(knownName)})`;
    expect(duplicates).toEqual([]);

    // 重复投递同一批次：pending 候选走条件更新，计数与 article_count 幂等递增
    const rerun = await repository.enqueueSiteScan(batch);
    expect(rerun).toEqual({ known: 2, queued: 1, existingSources: 1 });
    const [refreshed] = await sql<Array<{ articleCount: number }>>`
      select article_count as "articleCount" from job_market_company_candidates
      where normalized_name=${normalizeText(newName)}`;
    expect(refreshed?.articleCount).toBe(2);
  } finally {
    await sql`delete from job_market_company_candidates
      where normalized_name in (${normalizeText(newName)}, ${normalizeText(duplicateSourceName)})`;
    await sql`delete from job_market_sources where id=${sourceId}`;
    await sql`delete from job_market_companies where id in (${knownCompany.id}, ${sourceOwner.id})`;
    await sql.end();
  }
});
