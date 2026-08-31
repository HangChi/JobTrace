import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { SourceHealthTable } from "@/modules/job-market/ui/admin/source-health-table";
import { DefaultSourceBootstrap } from "@/modules/job-market/ui/admin/default-source-bootstrap";
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
});
