import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FollowUpList } from "@/modules/analytics/ui/follow-up-list";
import type { ApplicationDetail } from "@/modules/applications";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const application: ApplicationDetail = {
  id: "follow-up-1",
  companyName: "待跟进科技",
  positionName: "后端工程师",
  city: "杭州",
  jobUrl: null,
  appliedDate: "2026-07-01",
  type: "campus_recruitment",
  status: "submitted",
  latestDate: "2026-07-01",
  stages: ["screening"],
  needsFollowUp: true,
  followUpDays: 30,
  followUpReason: "application",
  version: 1,
  notes: "联系招聘负责人",
  stageOccurrences: [
    { id: "stage-1", stage: "screening", occurredOn: "2026-07-01" },
  ],
  events: [],
  createdAt: "2026-07-01T00:00:00Z",
  updatedAt: "2026-07-01T00:00:00Z",
};

describe("需要跟进列表", () => {
  it("点击记录后在当前页面打开共享详情弹窗", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ application, interviews: [] }),
      }),
    );
    render(<FollowUpList items={[application]} />);

    expect(screen.queryByRole("link", { name: "待跟进科技" })).toBeNull();
    fireEvent.click(
      screen.getByRole("button", {
        name: "查看 待跟进科技（杭州） 后端工程师 详情",
      }),
    );

    expect(screen.getByRole("dialog")).toHaveAttribute("open");
    expect(
      screen.getByRole("heading", { name: "待跟进科技（杭州） · 后端工程师" }),
    ).toBeVisible();
    await waitFor(() =>
      expect(screen.getByText("联系招聘负责人")).toBeVisible(),
    );
    expect(fetch).toHaveBeenCalledWith(
      "/api/applications/follow-up-1/detail",
      expect.objectContaining({
        signal: expect.any(AbortSignal),
        cache: "no-store",
      }),
    );
  });
});
