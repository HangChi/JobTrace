import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResetPageOnReload } from "@/modules/applications/ui/reset-page-on-reload";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

describe("刷新时重置分页", () => {
  beforeEach(() => {
    replace.mockReset();
    window.history.replaceState({}, "", "/?page=2&limit=10");
  });

  it("普通刷新第二页时回到第一页并保留其他条件", async () => {
    vi.spyOn(performance, "getEntriesByType").mockReturnValue([
      {
        name: window.location.href,
        type: "reload",
      } as PerformanceNavigationTiming,
    ]);

    render(<ResetPageOnReload />);

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/?limit=10", { scroll: false }),
    );
  });

  it("点击分页进入第二页时保留当前页", () => {
    vi.spyOn(performance, "getEntriesByType").mockReturnValue([
      {
        name: window.location.href,
        type: "navigate",
      } as PerformanceNavigationTiming,
    ]);

    render(<ResetPageOnReload />);

    expect(replace).not.toHaveBeenCalled();
  });
});
