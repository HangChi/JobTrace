import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { ApplyAction } from "@/modules/job-market/ui/apply-action";
afterEach(() => vi.unstubAllGlobals());
describe("campaign apply actions", () => {
  it("opens a safe single URL directly", () => {
    render(
      <ApplyAction
        campaignId="id"
        mode="single"
        url="https://jobs.example.com/apply"
        status="open"
      />,
    );
    expect(screen.getByRole("link", { name: "立即投递" })).toHaveAttribute(
      "rel",
      "noopener noreferrer",
    );
  });
  it("loads choices without splitting the campaign", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            jobs: [
              {
                id: "job",
                title: "工程师",
                locations: [{ name: "上海", isRemote: false }],
                status: "open",
                applyUrl: "https://jobs.example.com/job",
                alreadyTrackedApplicationId: null,
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );
    render(
      <ApplyAction campaignId="id" mode="select" url={null} status="open" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "立即投递" }));
    await waitFor(() =>
      expect(screen.getByText("工程师").closest("a")).toHaveAttribute(
        "href",
        "https://jobs.example.com/job",
      ),
    );
  });
  it("disables unavailable or closed records", () => {
    render(
      <ApplyAction
        campaignId="id"
        mode="unavailable"
        url={null}
        status="closed"
      />,
    );
    expect(screen.getByRole("button", { name: "立即投递" })).toBeDisabled();
  });
});
