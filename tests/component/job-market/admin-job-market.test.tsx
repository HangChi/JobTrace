import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { SourceHealthTable } from "@/modules/job-market/ui/admin/source-health-table";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
afterEach(() => vi.unstubAllGlobals());
describe("job market admin health", () => {
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
