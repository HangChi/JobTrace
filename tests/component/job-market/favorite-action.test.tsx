import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { FavoriteButton } from "@/modules/job-market/ui/favorite-button";
afterEach(() => vi.unstubAllGlobals());
describe("campaign favorite", () => {
  it("optimistically favorites and persists", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    render(<FavoriteButton campaignId="id" initial={false} />);
    fireEvent.click(screen.getByRole("button", { name: "收藏招聘记录" }));
    expect(screen.getByRole("button", { name: "取消收藏" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/job-market/campaigns/id/favorite",
        { method: "PUT" },
      ),
    );
  });
  it("rolls back after failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("{}", { status: 500 })),
    );
    render(<FavoriteButton campaignId="id" initial={false} />);
    fireEvent.click(screen.getByRole("button", { name: "收藏招聘记录" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "收藏招聘记录" }),
      ).toHaveAttribute("aria-pressed", "false"),
    );
    expect(screen.getByRole("status")).toHaveTextContent("收藏失败");
  });
});
