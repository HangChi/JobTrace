import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { JobMarketPage } from "@/modules/job-market/ui/job-market-page";
import type { CampaignSummary } from "@/modules/job-market/domain/entities";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));
const campaign: CampaignSummary = {
  id: "11111111-1111-4111-8111-111111111111",
  company: { id: "c", name: "示例科技", type: "民营企业", industry: "软件" },
  campaignName: "2027 秋招",
  recruitmentType: "campus",
  batchLabel: "2027",
  positions: ["前端工程师", "后端工程师", "算法工程师", "产品经理"],
  positionCount: 4,
  locations: [
    { name: "上海", isRemote: false },
    { name: "杭州", isRemote: false },
  ],
  status: "open",
  applyMode: "single",
  primaryApplyUrl: "https://jobs.example.com/apply",
  source: { name: "greenhouse", url: "https://jobs.example.com" },
  publishedAt: null,
  validThrough: null,
  lastConfirmedAt: "2026-08-30T00:00:00Z",
  isFavorite: false,
};
describe("job market page", () => {
  it("renders one aggregated campaign with compact expandable positions", () => {
    render(
      <JobMarketPage
        page={{ items: [campaign], page: 1, limit: 20, total: 1 }}
        query={{}}
      />,
    );
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByText("示例科技")).toBeVisible();
    expect(
      screen.getByText("前端工程师、后端工程师、算法工程师"),
    ).toBeVisible();
    fireEvent.click(screen.getByText("查看全部 4 个岗位"));
    expect(
      screen.getByText("前端工程师、后端工程师、算法工程师、产品经理"),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "立即投递" })).toHaveAttribute(
      "target",
      "_blank",
    );
  });
  it("shows a useful filtered empty state", () => {
    render(
      <JobMarketPage
        page={{ items: [], page: 1, limit: 20, total: 0 }}
        query={{ q: "none" }}
      />,
    );
    expect(screen.getByText("没有符合条件的招聘记录")).toBeVisible();
    for (const link of screen.getAllByRole("link", { name: "清除筛选" })) {
      expect(link).toHaveAttribute("href", "/");
    }
  });
});
