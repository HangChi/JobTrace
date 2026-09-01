import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { SourceHealthTable } from "@/modules/job-market/ui/admin/source-health-table";
import { DefaultSourceBootstrap } from "@/modules/job-market/ui/admin/default-source-bootstrap";
import { SourceDiscoveryPanel } from "@/modules/job-market/ui/admin/source-discovery-panel";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
afterEach(() => vi.unstubAllGlobals());
describe("job market admin health", () => {
  it("initializes the curated catalog and reports first-sync results", async () => {
    const fetch = vi.fn().mockResolvedValue(
      Response.json(
        {
          companyCount: 8,
          sourceCount: 8,
          createdCompanies: 8,
          createdSources: 8,
          sync: {
            accepted: 8,
            succeeded: 7,
            partial: 1,
            failed: 0,
            skipped: 0,
          },
        },
        { status: 201 },
      ),
    );
    vi.stubGlobal("fetch", fetch);
    render(
      <DefaultSourceBootstrap
        scheduledSyncEnabled={false}
        catalog={[
          {
            companyName: "示例公司",
            adapter: "greenhouse",
            industry: "开发者工具",
            websiteUrl: "https://example.com/",
          },
        ]}
      />,
    );

    expect(screen.getByText(/持续定时同步尚未启用/)).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "一键初始化并首次同步" }),
    );
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith("/api/admin/job-market/bootstrap", {
        method: "POST",
      }),
    );
    expect(await screen.findByText(/首次同步成功 7 个/)).toBeVisible();
  });

  it("shows safe counts and retries one active source", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 202 }));
    vi.stubGlobal("fetch", fetch);
    render(
      <SourceHealthTable
        sources={[
          {
            id: "source",
            company: { name: "示例公司" },
            adapter: "greenhouse",
            status: "active",
            lastAttemptAt: "2026-08-30",
            lastSuccessAt: null,
            latestRun: {
              counts: { discovered: 4, created: 2, updated: 1, closed: 1 },
              errorSummary: "Source request timed out",
            },
          },
        ]}
      />,
    );
    expect(screen.getByText(/发现 4/)).toBeVisible();
    expect(screen.getByText("Source request timed out")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/admin/job-market/sources/source/sync",
        { method: "POST" },
      ),
    );
  });

  it("scans directory entries and requires explicit approval for a candidate", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ scanned: 10, recognized: 2 }, { status: 202 }),
      )
      .mockResolvedValueOnce(
        Response.json({ reviewStatus: "approved", sourceId: "source" }),
      );
    vi.stubGlobal("fetch", fetch);
    render(
      <SourceDiscoveryPanel
        summary={{
          automaticCompanies: 43,
          directoryCompanies: 1064,
          scannableCompanies: 6,
          reviewedCompanies: 1,
          pendingCandidates: 1,
        }}
        candidates={[
          {
            id: "candidate",
            companyId: "company",
            companyName: "示例科技",
            companyType: "民营企业",
            entryUrl: "https://careers.example.com/",
            adapter: "ashby",
            externalKey: "example",
            baseUrl: "https://api.ashbyhq.com/",
            allowedHosts: ["api.ashbyhq.com"],
            confidence: "high",
            evidenceCode: "known_ashby_url",
            reviewStatus: "pending",
            healthStatus: "healthy",
            diagnosticCode: null,
            diagnosticSummary: null,
            httpStatus: 200,
            approvedSourceId: null,
            lastCheckedAt: "2026-09-01T00:00:00Z",
          },
        ]}
      />,
    );
    expect(screen.getByText("43")).toBeVisible();
    expect(screen.getByText("ashby")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "扫描下一批" }));
    expect(await screen.findByText(/已检查 10 家/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "批准并启用" }));
    await waitFor(() =>
      expect(fetch).toHaveBeenLastCalledWith(
        "/api/admin/job-market/discovery/candidate",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ action: "approve" }),
        }),
      ),
    );
  });
});
