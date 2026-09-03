import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { FavoriteButton } from "@/modules/job-market/ui/favorite-button";

const { refreshMock } = vi.hoisted(() => ({ refreshMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

afterEach(() => vi.unstubAllGlobals());
beforeEach(() => refreshMock.mockClear());

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
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "取消收藏" })).toBeEnabled(),
    );
    expect(refreshMock).toHaveBeenCalledOnce();
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
  it("refreshes prefetched list variants after unfavoriting", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("{}", { status: 200 })),
    );
    render(<FavoriteButton campaignId="id" initial={true} />);
    fireEvent.click(screen.getByRole("button", { name: "取消收藏" }));
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "收藏招聘记录" }),
      ).toBeEnabled(),
    );
  });
});
