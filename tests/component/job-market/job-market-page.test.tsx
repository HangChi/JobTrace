import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { JobMarketPage } from "@/modules/job-market/ui/job-market-page";
import type { CampaignSummary } from "@/modules/job-market/domain/entities";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));
const campaign: CampaignSummary = {
  id: "11111111-1111-4111-8111-111111111111",
  listingKind: "synced_jobs",
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
  it("renders one aggregated campaign as a compact table row", () => {
    render(
      <JobMarketPage
        page={{ items: [campaign], page: 1, limit: 20, total: 1 }}
        query={{}}
      />,
    );
    expect(screen.getByRole("table")).toBeVisible();
    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(screen.getByText("示例科技")).toBeVisible();
    expect(screen.getAllByText("前端工程师")[0]).toBeVisible();
    expect(screen.getByText("4 个岗位")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "查看全部 4 个岗位" }),
    ).toHaveAttribute(
      "popovertarget",
      "campaign-11111111-1111-4111-8111-111111111111-positions",
    );
    expect(screen.getByRole("dialog", { name: "全部岗位" })).toHaveAttribute(
      "popover",
      "auto",
    );
    expect(screen.getByRole("link", { name: "立即投递" })).toHaveAttribute(
      "target",
      "_blank",
    );
  });
  it("renders a directory-only company with a clearly labelled public-account link", () => {
    render(
      <JobMarketPage
        page={{
          items: [
            {
              ...campaign,
              id: "22222222-2222-4222-8222-222222222222",
              listingKind: "recruitment_directory",
              company: { ...campaign.company, name: "目录企业" },
              campaignName: "公众号搜索：目录企业招聘",
              recruitmentType: "公众号",
              positions: [],
              positionCount: 0,
              locations: [],
              primaryApplyUrl:
                "https://weixin.sogou.com/weixin?type=1&query=example",
              source: {
                name: "公众号",
                url: "https://weixin.sogou.com/weixin?type=1&query=example",
              },
              lastConfirmedAt: null,
            },
          ],
          page: 1,
          limit: 20,
          total: 1,
        }}
        query={{}}
      />,
    );
    expect(screen.getByText("公众号发布")).toBeVisible();
    expect(screen.getByText("岗位以最新推文为准")).toBeVisible();
    expect(screen.getByText("目录入口 · 非自动同步")).toBeVisible();
    expect(screen.getByRole("link", { name: "查看公众号" })).toHaveAttribute(
      "href",
      expect.stringContaining("weixin.sogou.com"),
    );
    expect(screen.queryByText("记录投递")).not.toBeInTheDocument();
  });
  it("distinguishes an official recruitment directory from a WeChat directory", () => {
    render(
      <JobMarketPage
        page={{
          items: [
            {
              ...campaign,
              id: "33333333-3333-4333-8333-333333333333",
              listingKind: "recruitment_directory",
              company: { ...campaign.company, name: "官网企业" },
              campaignName: "官方招聘网站",
              recruitmentType: "招聘官网",
              positions: [],
              positionCount: 0,
              locations: [],
              primaryApplyUrl: "https://company.example.com/careers",
              source: {
                name: "招聘官网",
                url: "https://company.example.com/careers",
              },
              lastConfirmedAt: null,
            },
          ],
          page: 1,
          limit: 20,
          total: 1,
        }}
        query={{}}
      />,
    );
    expect(screen.getByText("官网招聘")).toBeVisible();
    expect(screen.getByText("岗位以官网发布为准")).toBeVisible();
    expect(screen.getByRole("link", { name: "查看官网" })).toHaveAttribute(
      "href",
      "https://company.example.com/careers",
    );
    expect(screen.queryByText("公众号发布")).not.toBeInTheDocument();
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
